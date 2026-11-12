import {
  createFormDataEntry,
  createId,
  createKeyValue,
  createRequest,
  FOLDER_COLORS,
  HTTP_METHODS,
  nowIso,
  type ApiRequest,
  type FolderColor,
  type FormDataEntry,
  type HttpMethod,
  type KeyValue,
  type RawBodyType,
  type RequestAuth,
  type RequestCollection,
  type RequestExample,
  type RequestFolder
} from './domain'
import { findUnresolvedVariables } from './variables'

export interface ImportedPostmanEnvironment {
  name: string
  variables: KeyValue[]
}

export interface ImportedPostman {
  collection: RequestCollection
  variables: KeyValue[]
  warnings: string[]
  title: string
  schemaVersion: 'v2.0' | 'v2.1'
  requestCount: number
  folderCount: number
}

type JsonObject = Record<string, unknown>

const MAX_REQUESTS = 5000
const RAW_LANGUAGES: Record<string, RawBodyType> = {
  json: 'json',
  text: 'text',
  javascript: 'javascript',
  html: 'html',
  xml: 'xml'
}
const FOLDER_PALETTE = FOLDER_COLORS.filter(
  (color): color is Exclude<FolderColor, 'default'> => color !== 'default'
)

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Postman descriptions are either a string or `{ content, type }`. */
function description(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (isObject(value)) return asString(value['content']).trim()
  return ''
}

function schemaVersion(value: unknown): ImportedPostman['schemaVersion'] | null {
  if (!isObject(value) || !isObject(value['info']) || !Array.isArray(value['item'])) return null
  const schema = asString(value['info']['schema'])
  if (!/schema\.(getpostman|postman)\.com\/json\/collection\//i.test(schema)) return null
  return /v2\.0/.test(schema) ? 'v2.0' : 'v2.1'
}

export function isPostmanCollection(value: unknown): boolean {
  if (typeof value === 'string') {
    try {
      return schemaVersion(JSON.parse(value)) !== null
    } catch {
      return false
    }
  }
  return schemaVersion(value) !== null
}

function parseInput(input: string | unknown): JsonObject {
  if (typeof input !== 'string') {
    if (!isObject(input)) throw new Error('A coleção do Postman precisa ser um objeto JSON.')
    return input
  }
  const text = input.replace(/^﻿/, '').trim()
  if (!text) throw new Error('Cole o JSON da coleção ou escolha um arquivo.')
  try {
    const parsed: unknown = JSON.parse(text)
    if (!isObject(parsed)) throw new Error('not an object')
    return parsed
  } catch {
    throw new Error('Não foi possível ler o arquivo: ele não é um JSON válido.')
  }
}

function keyValues(rows: unknown): KeyValue[] {
  return asArray(rows)
    .filter(isObject)
    .filter((row) => asString(row['key']).trim() || asString(row['value']).trim())
    .map((row) => ({
      ...createKeyValue(asString(row['key']), asString(row['value'])),
      enabled: row['disabled'] !== true
    }))
}

/** Reads auth parameters in both shapes: v2.1 `[{ key, value }]` and v2.0 `{ key: value }`. */
function authParams(auth: JsonObject, type: string): Record<string, string> {
  const raw = auth[type]
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw.filter(isObject).map((entry) => [asString(entry['key']), asString(entry['value'])])
    )
  }
  if (isObject(raw))
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, asString(value)]))
  return {}
}

function convertAuth(auth: unknown, warnings: string[], where: string): RequestAuth | null {
  if (!isObject(auth)) return null
  const base = createRequest().auth
  const type = asString(auth['type'])
  const params = authParams(auth, type)
  switch (type) {
    case 'noauth':
      return base
    case 'bearer':
      return { ...base, type: 'bearer', token: params['token'] ?? '' }
    case 'basic':
      return {
        ...base,
        type: 'basic',
        username: params['username'] ?? '',
        password: params['password'] ?? ''
      }
    case 'apikey':
      return {
        ...base,
        type: 'api-key',
        apiKeyName: params['key'] ?? 'X-API-Key',
        apiKeyValue: params['value'] ?? '',
        apiKeyLocation: params['in'] === 'query' ? 'query' : 'header'
      }
    case 'oauth2': {
      const token = params['accessToken'] ?? ''
      warnings.push(`${where}: OAuth 2.0 importado como Bearer — gere o token e coloque em {{access_token}}.`)
      return { ...base, type: 'bearer', token: token || '{{access_token}}' }
    }
    default:
      warnings.push(`${where}: autenticação "${type || 'desconhecida'}" não é suportada e foi ignorada.`)
      return base
  }
}

interface ConvertedUrl {
  url: string
  params: KeyValue[]
  pathVariables: KeyValue[]
}

function convertUrl(value: unknown): ConvertedUrl {
  if (typeof value === 'string') return splitQuery(value, [])
  if (!isObject(value)) return { url: '', params: [], pathVariables: [] }

  let raw = asString(value['raw'])
  if (!raw) {
    const protocol = asString(value['protocol'])
    const host = Array.isArray(value['host'])
      ? value['host'].map(asString).join('.')
      : asString(value['host'])
    const path = Array.isArray(value['path'])
      ? value['path']
          .map((segment) => (isObject(segment) ? asString(segment['value']) : asString(segment)))
          .join('/')
      : asString(value['path'])
    const port = asString(value['port'])
    raw = `${protocol ? `${protocol}://` : ''}${host}${port ? `:${port}` : ''}${path ? `/${path}` : ''}`
  }
  const pathVariables = keyValues(value['variable'])
  // `:id` path segments become {{id}} so they resolve like any other variable.
  for (const variable of pathVariables) {
    raw = raw.replace(new RegExp(`/:${escapeRegExp(variable.key)}(?=/|\\?|#|$)`, 'g'), `/{{${variable.key}}}`)
  }
  const query = Array.isArray(value['query']) ? keyValues(value['query']) : null
  return { ...splitQuery(raw, query ?? []), ...(query ? { params: query } : {}), pathVariables }
}

function splitQuery(raw: string, fallback: KeyValue[]): ConvertedUrl {
  const index = raw.indexOf('?')
  if (index === -1) return { url: raw, params: fallback, pathVariables: [] }
  const params = raw
    .slice(index + 1)
    .split('#')[0]!
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const [key = '', ...rest] = pair.split('=')
      return createKeyValue(safeDecode(key), safeDecode(rest.join('=')))
    })
  return { url: raw.slice(0, index), params: fallback.length ? fallback : params, pathVariables: [] }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function convertBody(body: unknown, request: ApiRequest, warnings: string[], where: string): void {
  if (!isObject(body) || body['disabled'] === true) return
  const mode = asString(body['mode'])
  switch (mode) {
    case 'raw': {
      const content = asString(body['raw']).replace(/\r\n/g, '\n')
      if (!content.trim()) return
      const options =
        isObject(body['options']) && isObject(body['options']['raw']) ? body['options']['raw'] : {}
      const language = asString(options['language'])
      let rawType = RAW_LANGUAGES[language]
      if (!rawType) {
        try {
          JSON.parse(content)
          rawType = 'json'
        } catch {
          rawType = 'text'
        }
      }
      request.body = { ...request.body, mode: 'raw', rawType, content }
      return
    }
    case 'urlencoded':
      request.body = { ...request.body, mode: 'form-urlencoded', urlEncoded: keyValues(body['urlencoded']) }
      return
    case 'formdata': {
      let files = 0
      const entries: FormDataEntry[] = asArray(body['formdata'])
        .filter(isObject)
        .map((row) => {
          const isFile = row['type'] === 'file'
          if (isFile) files++
          return {
            ...createFormDataEntry(asString(row['key']), isFile ? '' : asString(row['value'])),
            enabled: row['disabled'] !== true,
            type: isFile ? 'file' : 'text',
            description: description(row['description'])
          }
        })
      request.body = { ...request.body, mode: 'form-data', formData: entries }
      if (files) warnings.push(`${where}: ${files} arquivo(s) do form-data precisam ser escolhidos de novo.`)
      return
    }
    case 'graphql': {
      const graphql = isObject(body['graphql']) ? body['graphql'] : {}
      request.body = {
        ...request.body,
        mode: 'graphql',
        graphql: { query: asString(graphql['query']), variables: asString(graphql['variables']) }
      }
      return
    }
    case 'file':
      request.body = { ...request.body, mode: 'binary', binaryFile: null }
      warnings.push(`${where}: o arquivo do body binário precisa ser escolhido de novo.`)
      return
    default:
      if (mode) warnings.push(`${where}: body "${mode}" não é suportado e foi ignorado.`)
  }
}

function convertExamples(responses: unknown, request: ApiRequest): RequestExample[] {
  return asArray(responses)
    .filter(isObject)
    .map((response, index) => {
      const headers = keyValues(response['header'])
      const body = asString(response['body'])
      const contentType =
        headers.find((header) => header.key.toLowerCase() === 'content-type')?.value ??
        (response['_postman_previewlanguage'] === 'json' ? 'application/json' : '')
      const createdAt = nowIso()
      return {
        id: createId('example'),
        name: asString(response['name']) || `Exemplo ${index + 1}`,
        createdAt,
        response: {
          id: createId('response'),
          requestId: request.id,
          requestName: request.name,
          method: request.method,
          url: request.url,
          status: Number(response['code']) || 0,
          statusText: asString(response['status']),
          durationMs: Number(response['responseTime']) || 0,
          sizeBytes: new TextEncoder().encode(body).length,
          headers,
          body,
          contentType,
          createdAt
        }
      }
    })
}

interface Context {
  warnings: string[]
  variables: Map<string, KeyValue>
  requestCount: number
  scriptCount: number
  truncated: boolean
}

function convertRequest(
  item: JsonObject,
  inheritedAuth: RequestAuth | null,
  path: string,
  context: Context
): ApiRequest {
  const name = asString(item['name']) || 'Request'
  const where = path ? `${path} › ${name}` : name
  const source = item['request']
  const request = createRequest(name)

  if (typeof source === 'string') {
    request.url = source
    return request
  }
  const raw = isObject(source) ? source : {}

  const method = asString(raw['method']).toUpperCase() || 'GET'
  if (HTTP_METHODS.includes(method as HttpMethod)) {
    request.method = method as HttpMethod
  } else {
    context.warnings.push(`${where}: método ${method} não é suportado; importado como GET.`)
  }

  const url = convertUrl(raw['url'])
  request.url = url.url
  request.params = url.params
  for (const variable of url.pathVariables) {
    if (!context.variables.has(variable.key))
      context.variables.set(variable.key, { ...variable, enabled: true })
  }

  request.headers = Array.isArray(raw['header'])
    ? keyValues(raw['header'])
    : typeof raw['header'] === 'string'
      ? raw['header']
          .split('\n')
          .map((line) => line.split(':'))
          .filter(([key]) => key?.trim())
          .map(([key = '', ...rest]) => createKeyValue(key.trim(), rest.join(':').trim()))
      : []

  const auth = raw['auth'] !== undefined ? convertAuth(raw['auth'], context.warnings, where) : inheritedAuth
  if (auth) request.auth = auth

  convertBody(raw['body'], request, context.warnings, where)
  request.examples = convertExamples(item['response'], request)
  if (asArray(item['event']).length) context.scriptCount++
  return request
}

/**
 * Converts a Postman Collection (v2.0 or v2.1) into a Postblack collection. Postblack folders are one
 * level deep, so nested Postman folders are flattened into "Parent / Child" folders, keeping order.
 */
export function importPostmanCollection(input: string | unknown): ImportedPostman {
  const document = parseInput(input)
  const version = schemaVersion(document)
  if (!version) {
    if (isObject(document['info']) && 'item' in document)
      throw new Error('Este arquivo parece uma coleção Postman v1, que não é suportada. Exporte como v2.1.')
    throw new Error('Este arquivo não é uma coleção do Postman (v2.0 ou v2.1).')
  }

  const info = document['info'] as JsonObject
  const title = asString(info['name']).trim() || 'Coleção do Postman'
  const context: Context = {
    warnings: [],
    variables: new Map(),
    requestCount: 0,
    scriptCount: 0,
    truncated: false
  }

  for (const variable of keyValues(document['variable'])) {
    context.variables.set(variable.key, {
      ...variable,
      enabled: true,
      ...(document['variable'] &&
      asArray(document['variable']).some(
        (entry) => isObject(entry) && entry['key'] === variable.key && entry['secret'] === true
      )
        ? { secret: true }
        : {})
    })
  }
  // Variables declared without a value still matter: keep them so the user sees what to fill in.
  for (const entry of asArray(document['variable']).filter(isObject)) {
    const key = asString(entry['key']).trim()
    if (key && !context.variables.has(key))
      context.variables.set(key, {
        ...createKeyValue(key, ''),
        ...(entry['secret'] === true ? { secret: true } : {})
      })
  }

  const rootAuth =
    document['auth'] !== undefined ? convertAuth(document['auth'], context.warnings, title) : null
  const timestamp = nowIso()
  const rootRequests: ApiRequest[] = []
  const folders: RequestFolder[] = []

  const walk = (items: unknown[], auth: RequestAuth | null, path: string, target: ApiRequest[]): void => {
    for (const item of items.filter(isObject)) {
      if (Array.isArray(item['item'])) {
        const name = asString(item['name']) || 'Pasta'
        const folderPath = path ? `${path} / ${name}` : name
        const folderAuth =
          item['auth'] !== undefined ? convertAuth(item['auth'], context.warnings, folderPath) : auth
        if (asArray(item['event']).length) context.scriptCount++
        const folder: RequestFolder = {
          id: createId('folder'),
          name: folderPath,
          requests: [],
          createdAt: timestamp,
          color: FOLDER_PALETTE[folders.length % FOLDER_PALETTE.length]
        }
        folders.push(folder)
        walk(item['item'], folderAuth, folderPath, folder.requests)
        continue
      }
      if (context.requestCount >= MAX_REQUESTS) {
        context.truncated = true
        continue
      }
      context.requestCount++
      target.push(convertRequest(item, auth, path, context))
    }
  }
  walk(document['item'] as unknown[], rootAuth, '', rootRequests)

  if (asArray(document['event']).length) context.scriptCount++
  if (context.scriptCount) {
    context.warnings.unshift(
      `${context.scriptCount} script(s) de pre-request/test do Postman não foram importados (o Postblack ainda não executa scripts).`
    )
  }
  if (context.truncated) context.warnings.push(`A coleção foi limitada a ${MAX_REQUESTS} requests.`)

  // Variables usually live in a separate Postman environment: surface the ones the requests use.
  const allRequests = [...rootRequests, ...folders.flatMap((folder) => folder.requests)]
  const missing = new Set<string>()
  for (const request of allRequests) {
    for (const name of referencedVariables(request)) {
      if (!name.startsWith('$') && !context.variables.has(name)) missing.add(name)
    }
  }
  for (const name of missing) context.variables.set(name, createKeyValue(name, ''))
  if (missing.size) {
    context.warnings.unshift(
      `${missing.size} variável(is) usada(s) mas sem valor na coleção: ${[...missing].join(', ')}. ` +
        'Importe também o environment do Postman ou preencha em Variáveis.'
    )
  }

  const nonEmptyFolders = folders.filter((folder) => folder.requests.length)
  return {
    collection: {
      id: createId('collection'),
      name: title,
      description: description(info['description']),
      requests: rootRequests,
      folders: nonEmptyFolders,
      createdAt: timestamp
    },
    variables: [...context.variables.values()],
    warnings: context.warnings,
    title,
    schemaVersion: version,
    requestCount: context.requestCount,
    folderCount: nonEmptyFolders.length
  }
}

function referencedVariables(request: ApiRequest): string[] {
  const texts = [
    request.url,
    ...request.params.flatMap((row) => [row.key, row.value]),
    ...request.headers.flatMap((row) => [row.key, row.value]),
    request.body.content,
    ...(request.body.urlEncoded ?? []).flatMap((row) => [row.key, row.value]),
    ...(request.body.formData ?? []).flatMap((row) => [row.key, row.value]),
    request.body.graphql?.query ?? '',
    request.body.graphql?.variables ?? '',
    request.auth.token,
    request.auth.username,
    request.auth.password,
    request.auth.apiKeyName,
    request.auth.apiKeyValue
  ]
  return texts.flatMap((text) => findUnresolvedVariables(text))
}

export function isPostmanEnvironment(value: unknown): boolean {
  const document = typeof value === 'string' ? safeParse(value) : value
  return (
    isObject(document) &&
    Array.isArray(document['values']) &&
    (document['_postman_variable_scope'] === 'environment' ||
      document['_postman_variable_scope'] === 'globals')
  )
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

/** Reads a Postman environment (or globals) export into variables. */
export function importPostmanEnvironment(input: string | unknown): ImportedPostmanEnvironment {
  const document = parseInput(input)
  if (!isPostmanEnvironment(document)) throw new Error('Este arquivo não é um environment do Postman.')
  return {
    name: asString(document['name']).trim() || 'Environment do Postman',
    variables: asArray(document['values'])
      .filter(isObject)
      .filter((entry) => asString(entry['key']).trim())
      .map((entry) => ({
        ...createKeyValue(asString(entry['key']).trim(), asString(entry['value'])),
        enabled: entry['enabled'] !== false,
        ...(entry['type'] === 'secret' ? { secret: true } : {})
      }))
  }
}
