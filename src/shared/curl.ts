import {
  HTTP_METHODS,
  createFormDataEntry,
  createKeyValue,
  createRequest,
  type ApiRequest,
  type HttpMethod,
  type ImportedCurl
} from './domain'
import { resolveVariables } from './variables'

function tokenize(command: string): string[] {
  const normalized = command.replace(/\\\r?\n/g, ' ')
  const tokens: string[] = []
  let current = ''
  let quote: "'" | '"' | null = null
  let escaped = false

  for (const character of normalized.trim()) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\' && quote !== "'") {
      escaped = true
      continue
    }
    if ((character === "'" || character === '"') && (!quote || quote === character)) {
      quote = quote ? null : character
      continue
    }
    if (/\s/.test(character) && !quote) {
      if (current) tokens.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (current) tokens.push(current)
  if (quote) throw new Error('The cURL command has an unclosed quote.')
  return tokens
}

function nextValue(tokens: string[], index: number, flag: string): string {
  const value = tokens[index + 1]
  if (!value) throw new Error(`Missing value after ${flag}.`)
  return value
}

export function importCurl(command: string): ImportedCurl {
  const tokens = tokenize(command)
  if (tokens[0]?.toLowerCase() !== 'curl') throw new Error('The command must start with curl.')

  const request = createRequest('Imported request')
  const warnings: string[] = []
  let explicitMethod = false

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    if (token === '-X' || token === '--request') {
      request.method = parseMethod(nextValue(tokens, index, token))
      explicitMethod = true
      index += 1
    } else if (token === '-H' || token === '--header') {
      const header = nextValue(tokens, index, token)
      const separator = header.indexOf(':')
      if (separator > -1)
        request.headers.push(
          createKeyValue(
            header.slice(0, separator).trim(),
            normalizeMarkdownValue(header.slice(separator + 1).trim())
          )
        )
      index += 1
    } else if (token === '-F' || token === '--form') {
      const formValue = nextValue(tokens, index, token)
      const separator = formValue.indexOf('=')
      if (separator > 0) {
        const entry = createFormDataEntry(formValue.slice(0, separator), formValue.slice(separator + 1))
        if (entry.value.startsWith('@')) {
          const path = entry.value.slice(1)
          entry.type = 'file'
          entry.file = {
            path,
            name: path.split(/[\\/]/).at(-1) ?? 'file',
            size: 0,
            mimeType: 'application/octet-stream'
          }
        }
        request.body.formData?.push(entry)
        request.body.mode = 'form-data'
      }
      if (!explicitMethod) request.method = 'POST'
      index += 1
    } else if (token === '--data-urlencode') {
      const pair = nextValue(tokens, index, token)
      const separator = pair.indexOf('=')
      request.body.urlEncoded?.push(
        createKeyValue(
          separator < 0 ? pair : pair.slice(0, separator),
          separator < 0 ? '' : pair.slice(separator + 1)
        )
      )
      request.body.mode = 'form-urlencoded'
      if (!explicitMethod) request.method = 'POST'
      index += 1
    } else if (['-d', '--data', '--data-raw', '--data-binary'].includes(token)) {
      request.body.content = nextValue(tokens, index, token)
      if (token === '--data-binary' && request.body.content.startsWith('@')) {
        const path = request.body.content.slice(1)
        request.body.mode = 'binary'
        request.body.binaryFile = {
          path,
          name: path.split(/[\\/]/).at(-1) ?? 'file',
          size: 0,
          mimeType: 'application/octet-stream'
        }
      } else {
        request.body.mode = 'raw'
        request.body.rawType = looksLikeJson(request.body.content) ? 'json' : 'text'
      }
      if (!explicitMethod) request.method = 'POST'
      index += 1
    } else if (token === '-u' || token === '--user') {
      const credentials = nextValue(tokens, index, token)
      const separator = credentials.indexOf(':')
      request.auth.type = 'basic'
      request.auth.username = separator < 0 ? credentials : credentials.slice(0, separator)
      request.auth.password = separator < 0 ? '' : credentials.slice(separator + 1)
      index += 1
    } else if (token === '--url') {
      request.url = normalizeMarkdownValue(nextValue(tokens, index, token))
      index += 1
    } else if (!token.startsWith('-') && !request.url) {
      request.url = normalizeMarkdownValue(token)
    } else if (token === '--location' || token === '-L') {
      continue
    } else if (token.startsWith('-')) {
      warnings.push(`Option ${token} is not supported yet.`)
    }
  }

  const authorization = request.headers.find((header) => header.key.toLowerCase() === 'authorization')
  if (authorization?.value.toLowerCase().startsWith('bearer ')) {
    request.auth.type = 'bearer'
    request.auth.token = authorization.value.slice(7)
    request.headers = request.headers.filter((header) => header.id !== authorization.id)
  }
  if (!request.url) throw new Error('No URL was found in the cURL command.')
  extractQueryParameters(request)
  return { request, warnings }
}

export function isCurlCommand(value: string): boolean {
  return /^\s*curl(?:\s|$)/i.test(value)
}

function parseMethod(value: string): HttpMethod {
  const method = value.toUpperCase()
  if (!HTTP_METHODS.includes(method as HttpMethod)) {
    throw new Error(`HTTP method ${method} is not supported yet.`)
  }
  return method as HttpMethod
}

function normalizeMarkdownValue(value: string): string {
  const markdownLink = value.match(/^\[([^\]]+)]\(([^)]+)\)$/)
  const unwrapped = markdownLink?.[2] ?? value
  return unwrapped.replace(/\\([_&])/g, '$1').replaceAll('&amp;', '&')
}

function extractQueryParameters(request: ApiRequest): void {
  try {
    const url = new URL(request.url)
    request.params = [...url.searchParams.entries()].map(([key, value]) => createKeyValue(key, value))
    url.search = ''
    request.url = url.toString()
  } catch {
    // Variable-based URLs are valid in Postblack but cannot be parsed before interpolation.
  }
}

function looksLikeJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:?&=%{}@+-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

export function generateCurl(request: ApiRequest, variables: Record<string, string> = {}): string {
  const url = requestUrlWithParams(request, variables)
  const lines = [`curl --request ${request.method}`, `  ${shellQuote(url)}`]
  const headers = request.headers.filter((header) => header.enabled && header.key.trim())
  const hasContentType = headers.some((header) => header.key.toLowerCase() === 'content-type')

  if (!hasContentType) {
    const rawType = request.body.mode === 'json' ? 'json' : (request.body.rawType ?? 'text')
    const inferredContentType =
      request.body.mode === 'graphql' ||
      (request.body.mode === 'raw' && rawType === 'json') ||
      request.body.mode === 'json'
        ? 'application/json'
        : request.body.mode === 'form-urlencoded'
          ? 'application/x-www-form-urlencoded'
          : request.body.mode === 'binary' && request.body.binaryFile
            ? request.body.binaryFile.mimeType
            : request.body.mode === 'raw' || request.body.mode === 'text'
              ? {
                  text: 'text/plain',
                  javascript: 'application/javascript',
                  html: 'text/html',
                  xml: 'application/xml',
                  json: 'application/json'
                }[rawType]
              : null
    if (inferredContentType) headers.push(createKeyValue('Content-Type', inferredContentType))
  }

  if (request.auth.type === 'bearer') {
    headers.push(createKeyValue('Authorization', `Bearer ${resolveVariables(request.auth.token, variables)}`))
  } else if (request.auth.type === 'basic') {
    const credentials = `${resolveVariables(request.auth.username, variables)}:${resolveVariables(request.auth.password, variables)}`
    lines.push(`  --user ${shellQuote(credentials)}`)
  } else if (request.auth.type === 'api-key' && request.auth.apiKeyLocation === 'header') {
    headers.push(
      createKeyValue(request.auth.apiKeyName, resolveVariables(request.auth.apiKeyValue, variables))
    )
  }

  for (const header of headers) {
    lines.push(`  --header ${shellQuote(`${header.key}: ${resolveVariables(header.value, variables)}`)}`)
  }
  if (request.body.mode === 'form-data') {
    for (const entry of (request.body.formData ?? []).filter((item) => item.enabled && item.key.trim())) {
      const value =
        entry.type === 'file' && entry.file ? `@${entry.file.path}` : resolveVariables(entry.value, variables)
      lines.push(`  --form ${shellQuote(`${resolveVariables(entry.key, variables)}=${value}`)}`)
    }
  } else if (request.body.mode === 'form-urlencoded') {
    const rows = request.body.urlEncoded ?? []
    if (rows.length) {
      for (const entry of rows.filter((item) => item.enabled && item.key.trim())) {
        lines.push(
          `  --data-urlencode ${shellQuote(`${resolveVariables(entry.key, variables)}=${resolveVariables(entry.value, variables)}`)}`
        )
      }
    } else if (request.body.content) {
      lines.push(`  --data-raw ${shellQuote(resolveVariables(request.body.content, variables))}`)
    }
  } else if (request.body.mode === 'binary' && request.body.binaryFile) {
    lines.push(`  --data-binary ${shellQuote(`@${request.body.binaryFile.path}`)}`)
  } else if (request.body.mode === 'graphql') {
    const variablesText = resolveVariables(request.body.graphql?.variables ?? '', variables).trim()
    let graphqlVariables: unknown = {}
    try {
      graphqlVariables = variablesText ? JSON.parse(variablesText) : {}
    } catch {
      graphqlVariables = variablesText
    }
    lines.push(
      `  --data-raw ${shellQuote(
        JSON.stringify({
          query: resolveVariables(request.body.graphql?.query ?? '', variables),
          variables: graphqlVariables
        })
      )}`
    )
  } else if (request.body.mode !== 'none' && request.body.content) {
    lines.push(`  --data-raw ${shellQuote(resolveVariables(request.body.content, variables))}`)
  }
  return lines.join(' \\\n')
}

function requestUrlWithParams(request: ApiRequest, variables: Record<string, string>): string {
  const rawUrl = resolveVariables(request.url, variables)
  try {
    const url = new URL(rawUrl)
    for (const param of request.params.filter((item) => item.enabled && item.key.trim())) {
      url.searchParams.set(resolveVariables(param.key, variables), resolveVariables(param.value, variables))
    }
    if (
      request.auth.type === 'api-key' &&
      request.auth.apiKeyLocation === 'query' &&
      request.auth.apiKeyName
    ) {
      url.searchParams.set(
        resolveVariables(request.auth.apiKeyName, variables),
        resolveVariables(request.auth.apiKeyValue, variables)
      )
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}
