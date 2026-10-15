import type { ApiRequest, KeyValue, ResponseSnapshot } from '../domain'
import type { AiTask } from './types'

export const MASK = '••••••'

const SENSITIVE_HEADER =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|x-auth-token)$/i
const SENSITIVE_NAME = /(token|secret|password|passwd|api[-_]?key|private|credential|session)/i

export interface AiContextInput {
  request: ApiRequest | null
  response: ResponseSnapshot | null
  variables: Array<{ key: string; value: string; scope: string }>
  environmentName: string | null
  maskSecrets: boolean
  maxResponseChars: number
}

/** Values that look like credentials regardless of the name they are stored under. */
export function looksSecret(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed) || /^\{\{[^}]+\}\}$/.test(trimmed) || /^https?:\/\//i.test(trimmed))
    return false
  if (/^eyJ[\w-]+\.[\w-]+\./.test(trimmed)) return true // JWT
  if (/^(sk|pk|rk|ghp|gho|xox[abp]|AKIA|AIza)[-_]?[A-Za-z0-9]/.test(trimmed) && trimmed.length >= 16)
    return true
  // Long random-looking strings: letters and digits mixed, no separators typical of prose or paths.
  return trimmed.length >= 32 && /[a-z]/i.test(trimmed) && /\d/.test(trimmed) && !/[\/.]{2,}/.test(trimmed)
}

function maskValue(value: string): string {
  if (!value) return value
  // Keep {{variables}} readable: they are references, not secrets.
  if (/^\{\{[^}]+\}\}$/.test(value.trim())) return value
  const bearer = value.match(/^(Bearer|Basic|Token)\s+/i)
  return bearer ? `${bearer[0]}${MASK}` : MASK
}

function rows(entries: KeyValue[], mask: (entry: KeyValue) => boolean): string {
  if (!entries.length) return '  (none)'
  return entries
    .map(
      (entry) =>
        `  - ${entry.enabled ? '' : '[disabled] '}${entry.key}: ${mask(entry) ? maskValue(entry.value) : entry.value}`
    )
    .join('\n')
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n… [truncated ${text.length - limit} of ${text.length} characters]`
}

function describeBody(request: ApiRequest, maskSecrets: boolean): string {
  const body = request.body
  switch (body.mode) {
    case 'none':
      return 'none'
    case 'graphql':
      return `GraphQL\nquery:\n${body.graphql?.query ?? ''}\nvariables:\n${body.graphql?.variables ?? ''}`
    case 'form-data':
      return `multipart/form-data\n${(body.formData ?? [])
        .map(
          (row) =>
            `  - ${row.key}: ${row.type === 'file' ? `[file ${row.file?.name ?? 'not selected'}]` : row.value}`
        )
        .join('\n')}`
    case 'form-urlencoded':
      return `x-www-form-urlencoded\n${rows(body.urlEncoded ?? [], (row) => maskSecrets && SENSITIVE_NAME.test(row.key))}`
    case 'binary':
      return `binary file ${body.binaryFile?.name ?? '(not selected)'}`
    default:
      return `${body.mode === 'raw' ? (body.rawType ?? 'text') : body.mode}\n${body.content}`
  }
}

function describeAuth(request: ApiRequest, maskSecrets: boolean): string {
  const auth = request.auth
  const secret = (value: string): string => (maskSecrets ? maskValue(value) : value)
  switch (auth.type) {
    case 'bearer':
      return `Bearer token: ${secret(auth.token)}`
    case 'basic':
      return `Basic — username: ${auth.username}, password: ${secret(auth.password)}`
    case 'api-key':
      return `API key in ${auth.apiKeyLocation} — ${auth.apiKeyName}: ${secret(auth.apiKeyValue)}`
    default:
      return 'none'
  }
}

/** Serializes what the assistant needs to know, masking secrets unless the user opted out. */
export function buildAiContext(input: AiContextInput): string {
  const { request, response, maskSecrets } = input
  const sections: string[] = []

  if (request) {
    sections.push(
      [
        `# Current request: ${request.name}`,
        `Method: ${request.method}`,
        `URL: ${request.url || '(empty)'}`,
        'Query params:',
        rows(
          request.params,
          (row) => maskSecrets && (SENSITIVE_NAME.test(row.key) || looksSecret(row.value))
        ),
        'Headers:',
        rows(
          request.headers,
          (row) =>
            maskSecrets &&
            (SENSITIVE_HEADER.test(row.key) || SENSITIVE_NAME.test(row.key) || looksSecret(row.value))
        ),
        `Auth: ${describeAuth(request, maskSecrets)}`,
        `Body: ${describeBody(request, maskSecrets)}`
      ].join('\n')
    )
  } else {
    sections.push('# No request is open.')
  }

  if (input.variables.length) {
    sections.push(
      [
        `# Variables available as {{name}} (active environment: ${input.environmentName ?? 'none'})`,
        ...input.variables.map(
          (variable) =>
            `  - ${variable.key} [${variable.scope}]: ${
              maskSecrets && (SENSITIVE_NAME.test(variable.key) || looksSecret(variable.value))
                ? MASK
                : variable.value
            }`
        )
      ].join('\n')
    )
  }

  if (response) {
    const headerText = rows(response.headers, (row) => maskSecrets && SENSITIVE_HEADER.test(row.key))
    sections.push(
      [
        `# Last response`,
        response.error
          ? `Error: ${response.error}`
          : `Status: ${response.status} ${response.statusText} · ${response.durationMs} ms · ${response.sizeBytes} bytes`,
        `Content-Type: ${response.contentType || 'unknown'}`,
        'Headers:',
        headerText,
        'Body:',
        truncate(response.body, input.maxResponseChars)
      ].join('\n')
    )
  } else {
    sections.push('# No response yet for this request.')
  }

  return sections.join('\n\n')
}

/** Rough heuristic used to pick an intent before the model sees the message. */
export function inferAiTask(message: string): AiTask {
  const text = message.toLowerCase()
  if (/\bcurl\b/.test(text)) return 'curl'
  if (
    /(troqu|substitu|alter|mud|edit|adicion|remov|coloc|set|change|replace|update|add|remove|rename|fix|corrij|preench|gere|gera|monte|crie)/.test(
      text
    )
  )
    return 'edit'
  if (
    /(explic|entend|analis|resum|o que|por que|porque|why|what|explain|summar|status|erro|error)/.test(text)
  )
    return 'explain'
  return 'chat'
}
