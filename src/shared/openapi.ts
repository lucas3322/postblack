import {
  FOLDER_COLORS,
  createFormDataEntry,
  createId,
  createKeyValue,
  createRequest,
  nowIso,
  type ApiRequest,
  type FolderColor,
  type FormDataEntry,
  type HttpMethod,
  type KeyValue,
  type RawBodyType,
  type RequestCollection,
  type RequestFolder
} from './domain'

export interface ImportedOpenApi {
  collection: RequestCollection
  variables: KeyValue[]
  warnings: string[]
  format: 'openapi-3' | 'swagger-2'
  title: string
  version: string
  operationCount: number
}

type JsonObject = Record<string, unknown>
type Format = ImportedOpenApi['format']

const MAX_OPERATIONS = 2000
const MAX_SAMPLE_DEPTH = 6
const MAX_REF_HOPS = 32
const FALLBACK_BASE_URL = 'http://localhost'
const SUPPORTED_METHODS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS'
}
const IGNORED_HEADER_PARAMS = new Set(['accept', 'content-type', 'authorization'])
const FOLDER_PALETTE = FOLDER_COLORS.filter((color): color is Exclude<FolderColor, 'default'> => {
  return color !== 'default'
})

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function detectFormat(value: unknown): Format | null {
  if (!isObject(value)) return null
  if (typeof value.openapi === 'string' && /^3\.\d+/.test(value.openapi)) return 'openapi-3'
  if (typeof value.swagger === 'string' && /^2(\.0)?$/.test(value.swagger.trim())) return 'swagger-2'
  return null
}

export function isOpenApiDocument(value: unknown): boolean {
  let candidate = value
  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value)
    } catch {
      return false
    }
  }
  const format = detectFormat(candidate)
  if (!format || !isObject(candidate)) return false
  if (isObject(candidate.paths)) return true
  return format === 'openapi-3' && (isObject(candidate.webhooks) || isObject(candidate.components))
}

function parseInput(input: string | unknown): JsonObject {
  let document: unknown = input
  if (typeof input === 'string') {
    const text = input.replace(/^﻿/, '').trim()
    if (!text) throw new Error('O documento OpenAPI está vazio.')
    try {
      document = JSON.parse(text)
    } catch {
      if (/^(openapi|swagger)\s*:/m.test(text) || /^[\w"'-]+\s*:\s/m.test(text)) {
        throw new Error(
          'Por enquanto apenas documentos OpenAPI/Swagger em JSON são suportados. Converta o YAML para JSON e tente novamente.'
        )
      }
      throw new Error('Não foi possível ler o documento: o conteúdo não é um JSON válido.')
    }
  }
  if (!isObject(document)) throw new Error('O documento OpenAPI precisa ser um objeto JSON.')
  if (typeof document.swagger === 'string' || typeof document.swagger === 'number') {
    if (!detectFormat(document))
      throw new Error(`Versão do Swagger não suportada: ${String(document.swagger)}. Use Swagger 2.0.`)
    return document
  }
  if (typeof document.openapi === 'string' || typeof document.openapi === 'number') {
    if (!detectFormat(document))
      throw new Error(`Versão do OpenAPI não suportada: ${String(document.openapi)}. Use OpenAPI 3.0 ou 3.1.`)
    return document
  }
  throw new Error(
    'O documento não parece ser uma especificação OpenAPI/Swagger (campo "openapi" ou "swagger" ausente).'
  )
}

class Importer {
  private readonly warnings = new Set<string>()
  private readonly variables = new Map<string, KeyValue>()
  private readonly format: Format

  constructor(private readonly doc: JsonObject) {
    this.format = detectFormat(doc) ?? 'openapi-3'
  }

  warn(message: string): void {
    this.warnings.add(message)
  }

  run(): ImportedOpenApi {
    const info = isObject(this.doc.info) ? this.doc.info : {}
    const title = asString(info.title).trim() || 'API importada'
    const version =
      typeof info.version === 'string' || typeof info.version === 'number' ? String(info.version) : ''
    if (!isObject(this.doc.info)) this.warn('O documento não possui o bloco "info"; usando um nome padrão.')

    this.addVariable('base_url', this.format === 'openapi-3' ? this.openApiBaseUrl() : this.swaggerBaseUrl())

    const timestamp = nowIso()
    const collection: RequestCollection = {
      id: createId('collection'),
      name: title,
      description: asString(info.description).trim(),
      requests: [],
      folders: [],
      createdAt: timestamp
    }

    const folders = new Map<string, RequestFolder>()
    const tagOrder = Array.isArray(this.doc.tags)
      ? this.doc.tags.map((tag) => (isObject(tag) ? asString(tag.name).trim() : '')).filter(Boolean)
      : []
    const grouped = new Map<string, ApiRequest[]>()
    let operationCount = 0
    let truncated = false

    const paths = this.doc.paths
    if (paths !== undefined && !isObject(paths)) this.warn('O campo "paths" é inválido e foi ignorado.')
    if (!isObject(paths) || !Object.keys(paths).length)
      this.warn('O documento não possui operações em "paths".')

    outer: for (const [path, rawPathItem] of Object.entries(isObject(paths) ? paths : {})) {
      const pathItem = this.resolve(rawPathItem)
      if (!isObject(pathItem)) {
        this.warn(`O caminho ${path} é inválido e foi ignorado.`)
        continue
      }
      for (const [key, rawOperation] of Object.entries(pathItem)) {
        const lowerKey = key.toLowerCase()
        if (lowerKey === 'trace') {
          this.warn(`O método TRACE não é suportado; a operação TRACE ${path} foi ignorada.`)
          continue
        }
        const method = SUPPORTED_METHODS[lowerKey]
        if (!method) continue
        const operation = this.resolve(rawOperation)
        if (!isObject(operation)) continue
        if (operationCount >= MAX_OPERATIONS) {
          truncated = true
          break outer
        }
        operationCount += 1
        const request = this.buildRequest(path, method, pathItem, operation)
        const tag = Array.isArray(operation.tags)
          ? operation.tags.map((item) => asString(item).trim()).find(Boolean)
          : undefined
        if (!tag) {
          collection.requests.push(request)
          continue
        }
        const list = grouped.get(tag) ?? []
        list.push(request)
        grouped.set(tag, list)
      }
    }
    if (truncated)
      this.warn(
        `O documento possui mais de ${MAX_OPERATIONS} operações; apenas as primeiras foram importadas.`
      )

    const orderedTags = [
      ...tagOrder.filter((tag) => grouped.has(tag)),
      ...[...grouped.keys()].filter((tag) => !tagOrder.includes(tag))
    ]
    for (const tag of orderedTags) {
      if (folders.has(tag)) continue
      folders.set(tag, {
        id: createId('folder'),
        name: tag,
        requests: grouped.get(tag) ?? [],
        createdAt: timestamp,
        color: FOLDER_PALETTE[folders.size % FOLDER_PALETTE.length]
      })
    }
    collection.folders = [...folders.values()]

    return {
      collection,
      variables: [...this.variables.values()],
      warnings: [...this.warnings],
      format: this.format,
      title,
      version,
      operationCount
    }
  }

  // ---------------------------------------------------------------------------
  // $ref handling

  private lookup(ref: string): unknown {
    if (!ref.startsWith('#')) {
      this.warn(`Referências externas não são suportadas: ${ref}`)
      return undefined
    }
    const pointer = ref.slice(1)
    if (!pointer) return this.doc
    let current: unknown = this.doc
    for (const rawSegment of pointer.replace(/^\//, '').split('/')) {
      const segment = decodeURIComponent(rawSegment).replace(/~1/g, '/').replace(/~0/g, '~')
      if (Array.isArray(current)) current = current[Number(segment)]
      else if (isObject(current)) current = current[segment]
      else current = undefined
      if (current === undefined) break
    }
    if (current === undefined) this.warn(`Referência não encontrada: ${ref}`)
    return current
  }

  /** Follows a chain of `$ref`s (with cycle protection) and returns the target value. */
  resolve(value: unknown): unknown {
    let current = value
    const seen = new Set<string>()
    for (let hop = 0; hop < MAX_REF_HOPS; hop += 1) {
      if (!isObject(current) || typeof current.$ref !== 'string') return current
      const ref = current.$ref
      if (seen.has(ref)) {
        this.warn(`Referência circular detectada: ${ref}`)
        return undefined
      }
      seen.add(ref)
      current = this.lookup(ref)
    }
    return undefined
  }

  // ---------------------------------------------------------------------------
  // Base URL

  private openApiBaseUrl(): string {
    const servers = Array.isArray(this.doc.servers) ? this.doc.servers : []
    const server = this.resolve(servers[0])
    if (!isObject(server) || !asString(server.url).trim()) {
      this.warn(`Nenhum servidor foi definido; usando ${FALLBACK_BASE_URL} como base_url.`)
      return FALLBACK_BASE_URL
    }
    const serverVariables = isObject(server.variables) ? server.variables : {}
    const url = asString(server.url)
      .trim()
      .replace(/\{([^{}]+)\}/g, (match, name: string) => {
        const variable = serverVariables[name]
        if (isObject(variable)) {
          if (variable.default !== undefined) return String(variable.default)
          if (Array.isArray(variable.enum) && variable.enum.length) return String(variable.enum[0])
        }
        this.warn(`A variável de servidor "${name}" não possui valor padrão.`)
        return match
      })
      .replace(/\/+$/, '')
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(url)) {
      this.warn(`A URL do servidor "${url || '/'}" é relativa; ajuste a variável base_url com o host da API.`)
    }
    return url
  }

  private swaggerBaseUrl(): string {
    const host = asString(this.doc.host).trim().replace(/\/+$/, '')
    const basePath = asString(this.doc.basePath).trim().replace(/\/+$/, '')
    const normalizedBasePath = basePath && !basePath.startsWith('/') ? `/${basePath}` : basePath
    if (!host) {
      this.warn(`O documento não define "host"; usando ${FALLBACK_BASE_URL} como base_url.`)
      return `${FALLBACK_BASE_URL}${normalizedBasePath}`
    }
    const schemes = Array.isArray(this.doc.schemes)
      ? this.doc.schemes.map((scheme) => asString(scheme).toLowerCase()).filter(Boolean)
      : []
    const scheme = !schemes.length || schemes.includes('https') ? 'https' : (schemes[0] ?? 'https')
    return `${scheme}://${host}${normalizedBasePath}`
  }

  // ---------------------------------------------------------------------------
  // Variables

  private addVariable(key: string, value: string, secret = false): void {
    if (!key || this.variables.has(key)) return
    const variable = createKeyValue(key, value)
    if (secret) variable.secret = true
    this.variables.set(key, variable)
  }

  // ---------------------------------------------------------------------------
  // Operations

  private buildRequest(
    path: string,
    method: HttpMethod,
    pathItem: JsonObject,
    operation: JsonObject
  ): ApiRequest {
    const name =
      asString(operation.summary).trim() || asString(operation.operationId).trim() || `${method} ${path}`
    const request = createRequest(name)
    request.method = method
    request.url = `{{base_url}}${(path.startsWith('/') ? path : `/${path}`).replace(
      /\{([^{}]+)\}/g,
      (_match, param: string) => `{{${param.trim()}}}`
    )}`

    const auth = this.applySecurity(request, operation)
    const parameters = this.mergeParameters(pathItem.parameters, operation.parameters)
    const cookies: { pair: string; required: boolean }[] = []
    const swaggerBody: JsonObject[] = []
    const swaggerForm: JsonObject[] = []

    for (const parameter of parameters) {
      const location = asString(parameter.in)
      const paramName = asString(parameter.name).trim()
      if (!paramName) continue
      const required = parameter.required === true
      if (location === 'path') {
        this.addVariable(paramName, this.parameterValue(parameter))
      } else if (location === 'query') {
        if (auth.apiKeyLocation === 'query' && auth.apiKeyName === paramName) continue
        const row = createKeyValue(paramName, this.parameterValue(parameter))
        row.enabled = required
        request.params.push(row)
      } else if (location === 'header') {
        if (IGNORED_HEADER_PARAMS.has(paramName.toLowerCase())) continue
        if (auth.apiKeyLocation === 'header' && auth.apiKeyName.toLowerCase() === paramName.toLowerCase())
          continue
        if (request.headers.some((header) => header.key.toLowerCase() === paramName.toLowerCase())) continue
        const row = createKeyValue(paramName, this.parameterValue(parameter))
        row.enabled = required
        request.headers.push(row)
      } else if (location === 'cookie') {
        cookies.push({ pair: `${paramName}=${this.parameterValue(parameter)}`, required })
      } else if (location === 'body') {
        swaggerBody.push(parameter)
      } else if (location === 'formData') {
        swaggerForm.push(parameter)
      }
    }

    if (cookies.length) {
      const existing = request.headers.find((header) => header.key.toLowerCase() === 'cookie')
      const pairs = cookies.map((cookie) => cookie.pair)
      if (existing) existing.value = [existing.value, ...pairs].join('; ')
      else {
        const row = createKeyValue('Cookie', pairs.join('; '))
        row.enabled = cookies.some((cookie) => cookie.required)
        request.headers.push(row)
      }
    }

    if (this.format === 'openapi-3') this.applyOpenApiBody(request, operation.requestBody)
    else this.applySwaggerBody(request, operation, swaggerBody, swaggerForm)
    return request
  }

  private mergeParameters(pathLevel: unknown, operationLevel: unknown): JsonObject[] {
    const merged = new Map<string, JsonObject>()
    for (const source of [pathLevel, operationLevel]) {
      if (!Array.isArray(source)) continue
      for (const raw of source) {
        const parameter = this.resolve(raw)
        if (!isObject(parameter)) continue
        merged.set(`${asString(parameter.in)}:${asString(parameter.name)}`, parameter)
      }
    }
    return [...merged.values()]
  }

  private parameterValue(parameter: JsonObject): string {
    const schema = this.resolve(parameter.schema)
    const value = firstDefined(
      parameter.example,
      parameter['x-example'],
      this.firstExampleValue(parameter.examples),
      parameter.default,
      Array.isArray(parameter.enum) ? parameter.enum[0] : undefined,
      isObject(schema) ? schema.example : undefined,
      isObject(schema) ? schema.default : undefined,
      isObject(schema) && Array.isArray(schema.enum) ? schema.enum[0] : undefined,
      isObject(schema) && Array.isArray(schema.examples) ? schema.examples[0] : undefined
    )
    return stringifyValue(value)
  }

  private firstExampleValue(examples: unknown): unknown {
    if (!isObject(examples)) return undefined
    for (const raw of Object.values(examples)) {
      const example = this.resolve(raw)
      if (isObject(example) && example.value !== undefined) return example.value
    }
    return undefined
  }

  // ---------------------------------------------------------------------------
  // Security

  private applySecurity(request: ApiRequest, operation: JsonObject): ApiRequest['auth'] {
    const requirements = Array.isArray(operation.security)
      ? operation.security
      : Array.isArray(this.doc.security)
        ? this.doc.security
        : []
    const schemes =
      this.format === 'openapi-3'
        ? isObject(this.doc.components) && isObject(this.doc.components.securitySchemes)
          ? this.doc.components.securitySchemes
          : {}
        : isObject(this.doc.securityDefinitions)
          ? this.doc.securityDefinitions
          : {}

    for (const requirement of requirements) {
      if (!isObject(requirement)) continue
      const names = Object.keys(requirement)
      if (!names.length) continue
      if (names.length > 1) {
        this.warn(
          `Requisitos de segurança combinados (${names.join(' + ')}) não são suportados; usando ${names[0]}.`
        )
      }
      for (const schemeName of names) {
        const scheme = this.resolve(schemes[schemeName])
        if (!isObject(scheme)) {
          this.warn(`O esquema de segurança "${schemeName}" não foi encontrado.`)
          continue
        }
        if (this.applyScheme(request, schemeName, scheme)) return request.auth
      }
    }
    return request.auth
  }

  private applyScheme(request: ApiRequest, schemeName: string, scheme: JsonObject): boolean {
    const type = asString(scheme.type)
    const auth = request.auth
    if (type === 'http' || type === 'basic') {
      const httpScheme = type === 'basic' ? 'basic' : asString(scheme.scheme).toLowerCase()
      if (httpScheme === 'bearer') {
        auth.type = 'bearer'
        auth.token = '{{bearer_token}}'
        this.addVariable('bearer_token', '', true)
        return true
      }
      if (httpScheme === 'basic') {
        auth.type = 'basic'
        auth.username = '{{username}}'
        auth.password = '{{password}}'
        this.addVariable('username', '')
        this.addVariable('password', '', true)
        return true
      }
      this.warn(
        `O esquema HTTP "${httpScheme}" (${schemeName}) não é suportado; configure a autenticação manualmente.`
      )
      return false
    }
    if (type === 'apiKey') {
      const keyName = asString(scheme.name).trim()
      const location = asString(scheme.in)
      if (!keyName) return false
      this.addVariable('api_key', '', true)
      if (location === 'header' || location === 'query') {
        auth.type = 'api-key'
        auth.apiKeyName = keyName
        auth.apiKeyValue = '{{api_key}}'
        auth.apiKeyLocation = location
        return true
      }
      if (location === 'cookie') {
        request.headers.push(createKeyValue('Cookie', `${keyName}={{api_key}}`))
        this.warn(`A API key "${schemeName}" é enviada via cookie; foi adicionado um header Cookie manual.`)
        return true
      }
      return false
    }
    if (type === 'oauth2' || type === 'openIdConnect') {
      auth.type = 'bearer'
      auth.token = '{{access_token}}'
      this.addVariable('access_token', '', true)
      this.warn(
        `O fluxo ${type === 'oauth2' ? 'OAuth 2.0' : 'OpenID Connect'} (${schemeName}) não é automatizado; informe o token na variável access_token.`
      )
      return true
    }
    this.warn(`O esquema de segurança "${schemeName}" (${type || 'desconhecido'}) não é suportado.`)
    return false
  }

  // ---------------------------------------------------------------------------
  // Bodies

  private applyOpenApiBody(request: ApiRequest, rawBody: unknown): void {
    const requestBody = this.resolve(rawBody)
    if (!isObject(requestBody) || !isObject(requestBody.content)) return
    const mediaTypes = Object.keys(requestBody.content)
    const mediaType = pickMediaType(mediaTypes)
    if (!mediaType) return
    const media = this.resolve(requestBody.content[mediaType])
    const mediaObject = isObject(media) ? media : {}
    const schema = mediaObject.schema
    const example = firstDefined(mediaObject.example, this.firstExampleValue(mediaObject.examples))
    this.applyBody(request, mediaType, schema, example)
  }

  private applySwaggerBody(
    request: ApiRequest,
    operation: JsonObject,
    bodyParams: JsonObject[],
    formParams: JsonObject[]
  ): void {
    const consumes = (Array.isArray(operation.consumes) ? operation.consumes : this.doc.consumes) ?? []
    const mediaTypes = Array.isArray(consumes) ? consumes.map(asString).filter(Boolean) : []
    const bodyParam = bodyParams[0]
    if (bodyParam) {
      const mediaType = pickMediaType(mediaTypes) ?? 'application/json'
      const example = firstDefined(
        bodyParam['x-example'],
        isObject(bodyParam['x-examples']) ? Object.values(bodyParam['x-examples'])[0] : undefined
      )
      this.applyBody(request, mediaType, bodyParam.schema, example)
      return
    }
    if (!formParams.length) return
    const multipart =
      formParams.some((param) => asString(param.type) === 'file') ||
      mediaTypes.some((type) => type.toLowerCase().startsWith('multipart/'))
    if (multipart) {
      request.body.mode = 'form-data'
      request.body.formData = formParams.map((param) => {
        const entry = createFormDataEntry(
          asString(param.name),
          asString(param.type) === 'file' ? '' : this.parameterValue(param)
        )
        entry.description = asString(param.description).trim()
        if (asString(param.type) === 'file') entry.type = 'file'
        return entry
      })
    } else {
      request.body.mode = 'form-urlencoded'
      request.body.urlEncoded = formParams.map((param) =>
        createKeyValue(asString(param.name), this.parameterValue(param))
      )
    }
  }

  private applyBody(request: ApiRequest, mediaType: string, rawSchema: unknown, example: unknown): void {
    const lower = mediaType.toLowerCase().split(';')[0]?.trim() ?? ''
    const schema = this.resolve(rawSchema)

    if (isJsonMediaType(lower)) {
      const value = example !== undefined ? example : this.sample(rawSchema)
      request.body.mode = 'raw'
      request.body.rawType = 'json'
      request.body.content =
        typeof value === 'string' ? prettyJsonString(value) : JSON.stringify(value ?? {}, null, 2)
      if (lower !== 'application/json') request.headers.push(createKeyValue('Content-Type', mediaType))
      return
    }

    if (lower === 'application/x-www-form-urlencoded') {
      const value = example !== undefined ? example : this.sample(rawSchema)
      request.body.mode = 'form-urlencoded'
      request.body.urlEncoded = isObject(value)
        ? Object.entries(value).map(([key, item]) => createKeyValue(key, stringifyValue(item)))
        : []
      return
    }

    if (lower.startsWith('multipart/')) {
      request.body.mode = 'form-data'
      request.body.formData = this.multipartEntries(schema, example)
      if (lower !== 'multipart/form-data')
        this.warn(`O tipo ${mediaType} foi importado como multipart/form-data em "${request.name}".`)
      return
    }

    const rawType = rawTypeFor(lower)
    if (!rawType) {
      request.body.mode = 'binary'
      request.body.binaryFile = null
      return
    }
    request.body.mode = 'raw'
    request.body.rawType = rawType
    request.body.content = typeof example === 'string' ? example : ''
    if (!['text/plain', 'application/xml', 'text/html', 'application/javascript'].includes(lower))
      request.headers.push(createKeyValue('Content-Type', mediaType))
  }

  private multipartEntries(schema: unknown, example: unknown): FormDataEntry[] {
    const sample = isObject(example) ? example : this.sample(schema)
    const properties = this.collectProperties(schema)
    const keys = new Set([...Object.keys(properties), ...(isObject(sample) ? Object.keys(sample) : [])])
    return [...keys].map((key) => {
      const property = this.resolve(properties[key])
      const isFile = isObject(property) && this.isBinarySchema(property)
      const value = isObject(sample) && !isFile ? stringifyValue(sample[key]) : ''
      const entry = createFormDataEntry(key, value)
      if (isFile) entry.type = 'file'
      if (isObject(property)) entry.description = asString(property.description).trim()
      return entry
    })
  }

  private isBinarySchema(schema: JsonObject): boolean {
    const format = asString(schema.format)
    if (format === 'binary' || format === 'base64' || asString(schema.type) === 'file') return true
    if (typeof schema.contentMediaType === 'string' && schema.contentMediaType !== 'text/plain') return true
    const items = this.resolve(schema.items)
    return asString(schema.type) === 'array' && isObject(items) && this.isBinarySchema(items)
  }

  private collectProperties(rawSchema: unknown, depth = 0): JsonObject {
    const schema = this.resolve(rawSchema)
    if (!isObject(schema) || depth > MAX_SAMPLE_DEPTH) return {}
    const properties: JsonObject = {}
    if (Array.isArray(schema.allOf)) {
      for (const part of schema.allOf) Object.assign(properties, this.collectProperties(part, depth + 1))
    }
    for (const key of ['oneOf', 'anyOf'] as const) {
      const options = schema[key]
      if (Array.isArray(options) && options.length)
        Object.assign(properties, this.collectProperties(options[0], depth + 1))
    }
    if (isObject(schema.properties)) Object.assign(properties, schema.properties)
    return properties
  }

  // ---------------------------------------------------------------------------
  // Sample generation

  sample(rawSchema: unknown, depth = 0, stack: string[] = []): unknown {
    let schema: unknown = rawSchema
    const refs = [...stack]
    for (let hop = 0; hop < MAX_REF_HOPS && isObject(schema) && typeof schema.$ref === 'string'; hop += 1) {
      const ref = schema.$ref
      if (refs.includes(ref)) return undefined
      refs.push(ref)
      schema = this.lookup(ref)
    }
    if (!isObject(schema) || depth > MAX_SAMPLE_DEPTH) return undefined

    if (schema.example !== undefined) return schema.example
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0]
    if (schema.const !== undefined) return schema.const
    if (schema.default !== undefined) return schema.default
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0]

    if (Array.isArray(schema.allOf) && schema.allOf.length) {
      let merged: unknown = undefined
      for (const part of schema.allOf) {
        const value = this.sample(part, depth + 1, refs)
        if (isObject(value) && (merged === undefined || isObject(merged)))
          merged = { ...(merged ?? {}), ...value }
        else if (merged === undefined && value !== undefined) merged = value
      }
      const own = isObject(schema.properties) ? this.sampleObject(schema, depth, refs) : undefined
      if (isObject(own)) return { ...(isObject(merged) ? merged : {}), ...own }
      if (merged !== undefined) return merged
    }
    for (const key of ['oneOf', 'anyOf'] as const) {
      const options = schema[key]
      if (Array.isArray(options) && options.length) {
        const value = this.sample(options[0], depth + 1, refs)
        const own = isObject(schema.properties) ? this.sampleObject(schema, depth, refs) : undefined
        if (isObject(value) && isObject(own)) return { ...own, ...value }
        if (value !== undefined) return value
      }
    }

    const type = schemaType(schema)
    if (
      type === 'object' ||
      (!type && (isObject(schema.properties) || isObject(schema.additionalProperties)))
    )
      return this.sampleObject(schema, depth, refs)
    if (type === 'array') {
      const item = this.sample(schema.items, depth + 1, refs)
      return item === undefined ? [] : [item]
    }
    if (type === 'string') return sampleString(asString(schema.format))
    if (type === 'integer' || type === 'number')
      return typeof schema.minimum === 'number' ? schema.minimum : 0
    if (type === 'boolean') return true
    if (type === 'null') return null
    return undefined
  }

  private sampleObject(schema: JsonObject, depth: number, refs: string[]): JsonObject {
    const result: JsonObject = {}
    if (isObject(schema.properties)) {
      for (const [key, property] of Object.entries(schema.properties)) {
        const resolved = this.resolve(property)
        if (isObject(resolved) && resolved.readOnly === true) continue
        const value = this.sample(property, depth + 1, refs)
        if (value !== undefined) result[key] = value
      }
    }
    if (!Object.keys(result).length && isObject(schema.additionalProperties)) {
      const value = this.sample(schema.additionalProperties, depth + 1, refs)
      if (value !== undefined) result.key = value
    }
    return result
  }
}

function schemaType(schema: JsonObject): string {
  if (typeof schema.type === 'string') return schema.type
  if (Array.isArray(schema.type)) {
    const types = schema.type.map(asString)
    return types.find((type) => type && type !== 'null') ?? types[0] ?? ''
  }
  return ''
}

function sampleString(format: string): string {
  switch (format) {
    case 'date-time':
      return '2024-01-01T00:00:00Z'
    case 'date':
      return '2024-01-01'
    case 'time':
      return '12:00:00'
    case 'email':
      return 'user@example.com'
    case 'uuid':
      return '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    case 'uri':
    case 'url':
      return 'https://example.com'
    case 'hostname':
      return 'example.com'
    case 'ipv4':
      return '192.168.0.1'
    case 'ipv6':
      return '::1'
    case 'password':
      return 'password'
    case 'byte':
      return 'c3RyaW5n'
    case 'binary':
      return ''
    default:
      return 'string'
  }
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null)
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) && value.every((item) => !isObject(item) && !Array.isArray(item)))
    return value.map((item) => String(item ?? '')).join(',')
  return JSON.stringify(value)
}

function prettyJsonString(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function isJsonMediaType(mediaType: string): boolean {
  return mediaType === 'application/json' || /[/+]json$/.test(mediaType) || mediaType === '*/*'
}

function rawTypeFor(mediaType: string): RawBodyType | null {
  if (mediaType === 'application/xml' || mediaType === 'text/xml' || mediaType.endsWith('+xml')) return 'xml'
  if (mediaType === 'text/html') return 'html'
  if (mediaType === 'application/javascript' || mediaType === 'text/javascript') return 'javascript'
  if (mediaType.startsWith('text/')) return 'text'
  if (
    mediaType === 'application/octet-stream' ||
    /^(image|audio|video|font)\//.test(mediaType) ||
    mediaType === 'application/pdf' ||
    mediaType === 'application/zip'
  )
    return null
  return 'text'
}

function pickMediaType(mediaTypes: string[]): string | undefined {
  const lower = mediaTypes.map((type) => type.toLowerCase().split(';')[0]?.trim() ?? '')
  const index = [
    lower.indexOf('application/json'),
    lower.findIndex((type) => type !== '*/*' && isJsonMediaType(type)),
    lower.indexOf('application/x-www-form-urlencoded'),
    lower.indexOf('multipart/form-data'),
    0
  ].find((candidate) => candidate >= 0 && candidate < mediaTypes.length)
  return index === undefined ? undefined : mediaTypes[index]
}

export function importOpenApi(input: string | unknown): ImportedOpenApi {
  return new Importer(parseInput(input)).run()
}
