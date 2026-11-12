import { describe, expect, it } from 'vitest'
import { createRequest, type ExecuteRequestInput, type ResponseSnapshot } from '../shared/domain'
import { runRequestScript } from './script-runner'

function input(source: string, phase: 'preRequest' | 'postResponse' = 'preRequest'): ExecuteRequestInput {
  const request = createRequest()
  request.url = 'https://example.com/{{token}}'
  request.scripts = { preRequest: '', postResponse: '', [phase]: source }
  return {
    request,
    variables: { token: 'old' },
    variableScopes: { global: { token: 'global' }, workspace: {}, environment: { token: 'old' } },
    hasEnvironment: true
  }
}

describe('request scripts', () => {
  it('resolves pre-request variables, preserves local priority and records scoped writes', async () => {
    const output = await runRequestScript(
      input(`
      pm.environment.set('token', 'new');
      pm.variables.set('nonce', '123');
      pm.test('substitution', () => pm.expect(pm.variables.replaceIn('{{token}}/{{nonce}}')).to.equal('new/123'));
      console.log('ready');
    `),
      'preRequest'
    )
    expect(output.result.error).toBeUndefined()
    expect(output.variables).toMatchObject({ token: 'new', nonce: '123' })
    expect(output.updates).toEqual([{ scope: 'environment', key: 'token', value: 'new' }])
    expect(output.result.tests).toEqual([{ name: 'substitution', passed: true }])
    expect(output.result.logs).toEqual(['log: ready'])
  })

  it('captures response tokens and reports both passing and failing tests', async () => {
    const response = {
      status: 200,
      statusText: 'OK',
      durationMs: 4,
      headers: [],
      body: '{"token":"abc"}'
    } as unknown as ResponseSnapshot
    const output = await runRequestScript(
      input(
        `
      pm.environment.set('token', pm.response.json().token);
      pm.test('status', () => pm.response.to.have.status(200));
      pm.test('failure', () => pm.expect(pm.response.code).to.equal(201));
    `,
        'postResponse'
      ),
      'postResponse',
      response
    )
    expect(output.result.error).toBeUndefined()
    expect(output.updates[0].value).toBe('abc')
    expect(output.result.tests.map((test) => test.passed)).toEqual([true, false])
  })

  it('requires an active environment and reports syntax errors', async () => {
    const output = await runRequestScript(
      { ...input("pm.environment.set('x', 'y')"), hasEnvironment: false },
      'preRequest'
    )
    expect(output.result.error).toContain('active environment')
    expect((await runRequestScript(input('const = ;'), 'preRequest')).result.error).toBeTruthy()
  })

  it('does not expose Node globals or host function constructors', async () => {
    const output = await runRequestScript(
      input(`
      pm.test('no Node', () => pm.expect(typeof process).to.equal('undefined'));
      pm.test('no require', () => pm.expect(typeof require).to.equal('undefined'));
      pm.environment.get.constructor('return process')();
    `),
      'preRequest'
    )
    expect(output.result.tests.every((test) => test.passed)).toBe(true)
    expect(output.result.error).toContain('Code generation')
  })

  it('terminates infinite scripts without blocking subsequent execution', async () => {
    const output = await runRequestScript(input('while (true) {}'), 'preRequest')
    expect(output.result.error).toMatch(/timed out|execution limit/)
    expect((await runRequestScript(input("pm.variables.set('ok', 'yes')"), 'preRequest')).variables.ok).toBe(
      'yes'
    )
  })
})
