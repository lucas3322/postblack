import { describe, expect, it } from 'vitest'
import { createKeyValue, createRequest } from '../domain'
import { applyAiActions } from './actions'
import { buildAiContext, inferAiTask, MASK } from './context'
import { FAILURE_COOLDOWN_MS, routeProviders, type RouteInput } from './routing'
import { createDefaultAiSettings, type AiAction } from './types'

const action = (partial: Partial<AiAction> & Pick<AiAction, 'type'>): AiAction => ({
  key: null,
  value: null,
  enabled: null,
  bodyType: null,
  authType: null,
  label: partial.type,
  ...partial
})

describe('buildAiContext', () => {
  const request = createRequest('Login')
  request.method = 'POST'
  request.url = '{{base_url}}/login'
  request.headers = [createKeyValue('Authorization', 'Bearer abc.def'), createKeyValue('X-Trace', '42')]
  request.auth = { ...request.auth, type: 'bearer', token: 'real-token' }
  request.body = { ...request.body, mode: 'raw', rawType: 'json', content: '{"user":"ada"}' }

  it('masks secrets but keeps variable references readable', () => {
    request.headers.push(createKeyValue('Cookie', '{{session}}'))
    const context = buildAiContext({
      request,
      response: null,
      variables: [
        { key: 'base_url', value: 'https://api.dev', scope: 'environment' },
        { key: 'api_token', value: 'sk-123', scope: 'global' },
        { key: 'customer', value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc', scope: 'workspace' }
      ],
      environmentName: 'Dev',
      maskSecrets: true,
      maxResponseChars: 100
    })
    expect(context).toContain(`Authorization: Bearer ${MASK}`)
    expect(context).toContain('X-Trace: 42')
    expect(context).toContain('Cookie: {{session}}')
    expect(context).toContain(`Bearer token: ${MASK}`)
    expect(context).toContain(`api_token [global]: ${MASK}`)
    expect(context).toContain('base_url [environment]: https://api.dev')
    expect(context).toContain(`customer [workspace]: ${MASK}`)
    expect(context).not.toContain('sk-123')
    expect(context).not.toContain('real-token')
  })

  it('sends real values when masking is off and truncates long bodies', () => {
    const context = buildAiContext({
      request,
      response: {
        id: 'r',
        requestId: request.id,
        requestName: request.name,
        method: 'POST',
        url: 'https://api.dev/login',
        status: 200,
        statusText: 'OK',
        durationMs: 10,
        sizeBytes: 400,
        headers: [],
        body: 'x'.repeat(400),
        contentType: 'application/json',
        createdAt: ''
      },
      variables: [],
      environmentName: null,
      maskSecrets: false,
      maxResponseChars: 100
    })
    expect(context).toContain('Bearer token: real-token')
    expect(context).toContain('[truncated 300 of 400 characters]')
  })
})

describe('looksSecret', () => {
  it('flags credential-shaped values but not URLs, ids or variables', async () => {
    const { looksSecret } = await import('./context')
    expect(looksSecret('sk-proj-abcdefghijklmnop')).toBe(true)
    expect(looksSecret('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7')).toBe(true)
    expect(looksSecret('https://api.example.com/v1/12345678901234567890')).toBe(false)
    expect(looksSecret('{{token}}')).toBe(false)
    expect(looksSecret('1042')).toBe(false)
    expect(looksSecret('approved')).toBe(false)
  })
})

describe('inferAiTask', () => {
  it('recognizes common intents in Portuguese and English', () => {
    expect(inferAiTask('monta um curl disso')).toBe('curl')
    expect(inferAiTask('troque o page para 2')).toBe('edit')
    expect(inferAiTask('explica essa resposta')).toBe('explain')
    expect(inferAiTask('olá')).toBe('chat')
  })
})

describe('applyAiActions', () => {
  it('applies edits without mutating the original request', () => {
    const request = createRequest('List')
    request.url = 'https://api.dev/items?page=1&size=10'
    request.headers = [createKeyValue('Accept', 'text/plain')]
    request.params = [createKeyValue('page', '1')]

    const result = applyAiActions(request, [
      action({ type: 'set_method', value: 'post' }),
      action({ type: 'upsert_header', key: 'accept', value: 'application/json' }),
      action({ type: 'upsert_header', key: 'X-Tenant', value: '{{tenant}}' }),
      action({ type: 'upsert_param', key: 'page', value: '2' }),
      action({ type: 'remove_param', key: 'size' }),
      action({ type: 'set_body', value: '{"a":1}', bodyType: 'json' }),
      action({ type: 'set_auth', authType: 'basic', key: 'ada', value: '{{password}}' }),
      action({ type: 'curl', value: 'curl https://api.dev' })
    ])

    expect(request.method).toBe('GET')
    expect(result.request.method).toBe('POST')
    expect(result.request.headers.map((row) => [row.key, row.value])).toEqual([
      ['accept', 'application/json'],
      ['X-Tenant', '{{tenant}}']
    ])
    expect(result.request.params.map((row) => [row.key, row.value])).toEqual([['page', '2']])
    expect(result.request.url).toBe('https://api.dev/items?page=1')
    expect(result.request.body).toMatchObject({ mode: 'raw', rawType: 'json', content: '{\n  "a": 1\n}' })
    expect(result.request.auth).toMatchObject({ type: 'basic', username: 'ada', password: '{{password}}' })
    expect(result.applied).toHaveLength(7)
  })

  it('reports actions it could not apply', () => {
    const result = applyAiActions(createRequest(), [
      action({ type: 'set_method', value: 'FETCH' }),
      action({ type: 'remove_header', key: 'Missing' })
    ])
    expect(result.applied).toHaveLength(0)
    expect(result.skipped.map((entry) => entry.reason)).toEqual([
      'unknown method FETCH',
      'header Missing not found'
    ])
  })

  it('keeps non-JSON bodies with variables as written', () => {
    const result = applyAiActions(createRequest(), [
      action({ type: 'set_body', value: '{"id": {{id}}}', bodyType: 'json' })
    ])
    expect(result.request.body.content).toBe('{"id": {{id}}}')
  })
})

describe('routeProviders', () => {
  const base = (): RouteInput => {
    const settings = createDefaultAiSettings()
    settings.providers.anthropic.enabled = true
    settings.providers.openai.enabled = true
    settings.providers.gemini.enabled = true
    return {
      settings,
      configured: { anthropic: true, openai: true, gemini: true },
      health: {},
      contextWindows: {},
      promptChars: 1_000,
      forced: null,
      now: 1_000_000
    }
  }

  it('follows the user priority and skips providers without keys or disabled', () => {
    const input = base()
    input.settings.priority = ['gemini', 'anthropic', 'openai']
    input.configured.gemini = false
    input.settings.providers.openai.enabled = false
    expect(routeProviders(input).map((entry) => entry.provider)).toEqual(['anthropic'])
  })

  it('demotes a provider that failed recently in smart mode only', () => {
    const input = base()
    input.health.anthropic = {
      lastFailureAt: input.now - 1_000,
      consecutiveFailures: 1,
      averageLatencyMs: null
    }
    expect(routeProviders(input)[0]).toEqual({
      provider: 'openai',
      reason: 'higher priority provider failed recently'
    })
    input.now += FAILURE_COOLDOWN_MS
    expect(routeProviders(input)[0]?.provider).toBe('anthropic')

    const strict = base()
    strict.settings.routing = 'priority'
    strict.health.anthropic = { lastFailureAt: strict.now, consecutiveFailures: 3, averageLatencyMs: null }
    expect(routeProviders(strict)[0]?.provider).toBe('anthropic')
  })

  it('skips models whose context window cannot hold the prompt', () => {
    const input = base()
    input.promptChars = 3_500_000
    input.contextWindows = { anthropic: 200_000, openai: 400_000, gemini: 2_000_000 }
    expect(routeProviders(input)[0]).toEqual({ provider: 'gemini', reason: 'larger context window needed' })
  })

  it('prefers a much faster neighbor for short prompts', () => {
    const input = base()
    input.health.anthropic = { lastFailureAt: null, consecutiveFailures: 0, averageLatencyMs: 9_000 }
    input.health.openai = { lastFailureAt: null, consecutiveFailures: 0, averageLatencyMs: 2_000 }
    expect(routeProviders(input).map((entry) => entry.provider)).toEqual(['openai', 'anthropic', 'gemini'])
  })

  it('puts a manually chosen provider first and keeps the others as fallback', () => {
    const input = base()
    input.forced = 'gemini'
    expect(routeProviders(input).map((entry) => entry.provider)).toEqual(['gemini', 'anthropic', 'openai'])
  })
})
