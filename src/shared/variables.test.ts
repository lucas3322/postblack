import { describe, expect, it } from 'vitest'
import { createInitialState, createKeyValue, createWorkspace } from './domain'
import {
  applyVariableUpdates,
  findUnresolvedVariables,
  resolveVariables,
  scopedVariableDetails,
  scopedVariables,
  splitVariableReferences
} from './variables'

describe('variables', () => {
  it('applies script writes only to their original scope and environment', () => {
    const state = createInitialState()
    const workspace = state.workspaces[0]!
    workspace.variables = [createKeyValue('token', 'workspace')]
    workspace.environments[0]!.variables = [{ ...createKeyValue('token', 'old'), secret: true }]
    workspace.environments.push({ id: 'other', name: 'Other', variables: [createKeyValue('token', 'other')] })
    const next = applyVariableUpdates(state, workspace.id, workspace.activeEnvironmentId, [
      { scope: 'environment', key: 'token', value: 'new' },
      { scope: 'global', key: 'run', value: '1' },
      { scope: 'workspace', key: 'token', value: null }
    ])
    expect(next.globalVariables[0]?.value).toBe('1')
    expect(next.workspaces[0]?.variables).toEqual([])
    expect(next.workspaces[0]?.environments[0]?.variables[0]).toMatchObject({ value: 'new', secret: true })
    expect(next.workspaces[0]?.environments[1]?.variables[0]?.value).toBe('other')
    expect(workspace.environments[0]?.variables[0]?.value).toBe('old')
  })
  it('resolves known values while preserving unresolved placeholders', () => {
    const result = resolveVariables('{{base_url}}/users/{{id}}', { base_url: 'https://api.example.com' })
    expect(result).toBe('https://api.example.com/users/{{id}}')
    expect(findUnresolvedVariables(result)).toEqual(['id'])
  })

  it('applies global, workspace, and environment precedence', () => {
    const workspace = createWorkspace()
    workspace.variables = [createKeyValue('base_url', 'https://production.example.com')]
    workspace.environments[0]!.variables = [createKeyValue('base_url', 'http://localhost:3000')]
    workspace.activeEnvironmentId = workspace.environments[0]!.id

    const globals = [
      createKeyValue('base_url', 'https://global.example.com'),
      createKeyValue('organization', 'postblack')
    ]

    expect(scopedVariables(globals, workspace)).toMatchObject({
      base_url: 'http://localhost:3000',
      organization: 'postblack'
    })
    expect(scopedVariableDetails(globals, workspace)).toMatchObject({
      base_url: { value: 'http://localhost:3000', secret: true, scope: 'environment' },
      organization: { value: 'postblack', secret: true, scope: 'global' }
    })
  })

  it('splits URL references without changing the underlying URL text', () => {
    const url = '{{base_url}}/users/{{ id }}?search={{missing}}'
    const segments = splitVariableReferences(url)

    expect(segments.map((part) => part.value).join('')).toBe(url)
    expect(segments.filter((part) => part.kind === 'variable').map((part) => part.name)).toEqual([
      'base_url',
      'id',
      'missing'
    ])
  })
})
