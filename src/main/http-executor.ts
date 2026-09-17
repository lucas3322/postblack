import { performance } from 'node:perf_hooks'
import { readFile } from 'node:fs/promises'
import {
  createId,
  createKeyValue,
  nowIso,
  type ExecuteRequestInput,
  type ResponseSnapshot
} from '../shared/domain'
import { findUnresolvedVariables, resolveVariables } from '../shared/variables'

const REQUEST_TIMEOUT_MS = 30_000
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024

export async function executeHttpRequest(input: ExecuteRequestInput): Promise<ResponseSnapshot> {
  const { request, variables } = input
  const url = buildUrl(request.url, request.params, request.auth, variables)
  const headers = buildHeaders(request.headers, request.auth, variables)
  const body = await buildBody(request.body, headers, variables)
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

async function buildBody(
  body: ExecuteRequestInput['request']['body'],
  headers: Headers,
  variables: Record<string, string>
): Promise<BodyInit | undefined> {
  const { mode, content } = body
  if (mode === 'none') return undefined

  if (mode === 'form-data') {
    headers.delete('content-type')
    const form = new FormData()
    let totalFileBytes = 0
    for (const entry of (body.formData ?? []).filter((item) => item.enabled && item.key.trim())) {
      const key = resolveVariables(entry.key, variables)
      if (entry.type === 'file') {
        if (!entry.file) continue
        totalFileBytes += entry.file.size
        if (totalFileBytes > MAX_UPLOAD_BYTES)
          throw new Error('Os arquivos excedem o limite total de 250 MB.')
        const contents = await readFile(entry.file.path)
        form.append(key, new Blob([contents], { type: entry.file.mimeType }), entry.file.name)
      } else {
        form.append(key, resolveVariables(entry.value, variables))
      }
    }
    return form
  }

  if (mode === 'binary') {
    if (!body.binaryFile) throw new Error('Selecione um arquivo para enviar no body binário.')
    if (body.binaryFile.size > MAX_UPLOAD_BYTES) throw new Error('O arquivo excede o limite de 250 MB.')
    if (!headers.has('content-type')) headers.set('Content-Type', body.binaryFile.mimeType)
    return new Blob([await readFile(body.binaryFile.path)], { type: body.binaryFile.mimeType })
  }

  if (mode === 'graphql') {
    if (!headers.has('content-type')) headers.set('Content-Type', 'application/json')
    const variablesText = resolveVariables(body.graphql?.variables ?? '', variables).trim()
    let graphqlVariables: unknown = {}
    if (variablesText) {
      try {
        graphqlVariables = JSON.parse(variablesText)
      } catch {
        throw new Error('As variables do GraphQL precisam ser um JSON válido.')
      }
    }
    return JSON.stringify({
      query: resolveVariables(body.graphql?.query ?? '', variables),
      variables: graphqlVariables
    })
  }

  if (mode === 'form-urlencoded') {
    if (!headers.has('content-type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded')
    }
    const rows = body.urlEncoded ?? []
    if (rows.length) {
      const params = new URLSearchParams()
      for (const entry of rows.filter((item) => item.enabled && item.key.trim())) {
        params.append(resolveVariables(entry.key, variables), resolveVariables(entry.value, variables))
      }
      return params.toString()
    }
  }

  const rawType = mode === 'json' ? 'json' : mode === 'text' ? 'text' : (body.rawType ?? 'json')
  if (!headers.has('content-type')) {
    const contentType = {
      json: 'application/json',
      text: 'text/plain',
      javascript: 'application/javascript',
      html: 'text/html',
      xml: 'application/xml'
    }[rawType]
    headers.set('Content-Type', contentType)
  }
  return resolveVariables(content, variables)
}

function supportsBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method)
}
