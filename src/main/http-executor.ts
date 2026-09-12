import { performance } from 'node:perf_hooks'
import {
  createId,
  createKeyValue,
  nowIso,
  type ExecuteRequestInput,
  type ResponseSnapshot
} from '../shared/domain'
import { findUnresolvedVariables, resolveVariables } from '../shared/variables'

const REQUEST_TIMEOUT_MS = 30_000

export async function executeHttpRequest(input: ExecuteRequestInput): Promise<ResponseSnapshot> {
  const { request, variables } = input
  const url = buildUrl(request.url, request.params, request.auth, variables)
  const headers = buildHeaders(request.headers, request.auth, variables)
  const body = buildBody(request.body.mode, request.body.content, headers, variables)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: supportsBody(request.method) ? body : undefined,
      signal: controller.signal
    })
    const responseBody = await response.text()
    return {
      id: createId('response'),
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url,
      status: response.status,
      statusText: response.statusText,
      durationMs: Math.round(performance.now() - startedAt),
      sizeBytes: Buffer.byteLength(responseBody),
      headers: [...response.headers.entries()].map(([key, value]) => createKeyValue(key, value)),
      body: responseBody,
      contentType: response.headers.get('content-type') ?? '',
      createdAt: nowIso()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error'
    return {
      id: createId('response'),
      requestId: request.id,
      requestName: request.name,
      method: request.method,
      url,
      status: 0,
      statusText: 'Request failed',
      durationMs: Math.round(performance.now() - startedAt),
      sizeBytes: 0,
      headers: [],
      body: '',
      contentType: '',
      error: message,
      createdAt: nowIso()
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildUrl(
  rawUrl: string,
  params: ExecuteRequestInput['request']['params'],
  auth: ExecuteRequestInput['request']['auth'],
  variables: Record<string, string>
): string {
  const resolvedUrl = resolveVariables(rawUrl.trim(), variables)
  if (!/^https?:\/\//i.test(resolvedUrl))
    throw new Error('Use a complete URL beginning with http:// or https://.')
  const url = new URL(resolvedUrl)
  for (const param of params.filter((item) => item.enabled && item.key.trim())) {
    url.searchParams.set(resolveVariables(param.key, variables), resolveVariables(param.value, variables))
  }
  if (auth.type === 'api-key' && auth.apiKeyLocation === 'query' && auth.apiKeyName) {
    url.searchParams.set(
      resolveVariables(auth.apiKeyName, variables),
      resolveVariables(auth.apiKeyValue, variables)
    )
  }
  return url.toString()
}

function buildHeaders(
  rows: ExecuteRequestInput['request']['headers'],
  auth: ExecuteRequestInput['request']['auth'],
  variables: Record<string, string>
): Headers {
  const headers = new Headers()
  for (const row of rows.filter((item) => item.enabled && item.key.trim())) {
    headers.set(resolveVariables(row.key, variables), resolveVariables(row.value, variables))
  }
  if (auth.type === 'bearer' && auth.token) {
    const token = resolveVariables(auth.token, variables).trim()
    const unresolved = findUnresolvedVariables(token)
    if (unresolved.length) {
      throw new Error(
        `Bearer token variable ${unresolved.map((name) => `{{${name}}}`).join(', ')} not found. Check the active environment, workspace or global variables.`
      )
    }
    if (!token) throw new Error('Bearer token is empty. Set a value for the selected variable.')
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (auth.type === 'basic') {
    const credentials = `${resolveVariables(auth.username, variables)}:${resolveVariables(auth.password, variables)}`
    headers.set('Authorization', `Basic ${Buffer.from(credentials).toString('base64')}`)
  }
  if (auth.type === 'api-key' && auth.apiKeyLocation === 'header' && auth.apiKeyName) {
    headers.set(resolveVariables(auth.apiKeyName, variables), resolveVariables(auth.apiKeyValue, variables))
  }
  return headers
}

function buildBody(
  mode: ExecuteRequestInput['request']['body']['mode'],
  content: string,
  headers: Headers,
  variables: Record<string, string>
): string | undefined {
  if (mode === 'none') return undefined
  if (mode === 'json' && !headers.has('content-type')) headers.set('Content-Type', 'application/json')
  if (mode === 'form-urlencoded' && !headers.has('content-type')) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded')
  }
  return resolveVariables(content, variables)
}

function supportsBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method)
}
