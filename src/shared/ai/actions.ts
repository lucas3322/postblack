import {
  createKeyValue,
  HTTP_METHODS,
  nowIso,
  type ApiRequest,
  type HttpMethod,
  type KeyValue
} from '../domain'
import type { AiAction } from './types'

export interface AppliedAiActions {
  request: ApiRequest
  applied: AiAction[]
  skipped: Array<{ action: AiAction; reason: string }>
}

const RAW_TYPES = { json: 'json', text: 'text', xml: 'xml', html: 'html' } as const

function upsert(rows: KeyValue[], key: string, value: string, enabled: boolean | null): KeyValue[] {
  const index = rows.findIndex((row) => row.key.toLowerCase() === key.toLowerCase())
  if (index === -1) return [...rows, { ...createKeyValue(key, value), enabled: enabled ?? true }]
  return rows.map((row, position) =>
    position === index ? { ...row, key, value, enabled: enabled ?? row.enabled } : row
  )
}

function remove(rows: KeyValue[], key: string): KeyValue[] {
  return rows.filter((row) => row.key.toLowerCase() !== key.toLowerCase())
}

/** Drops `key` from the URL's own query string so a removed param does not linger there. */
function removeFromQueryString(url: string, key: string): string {
  const [base, query] = url.split('?')
  if (!query) return url
  const kept = query
    .split('&')
    .filter((pair) => pair && pair.split('=')[0]?.toLowerCase() !== key.toLowerCase())
  return kept.length ? `${base}?${kept.join('&')}` : (base ?? '')
}

/** Applies assistant-proposed edits to a request. Pure: never mutates its input. */
export function applyAiActions(request: ApiRequest, actions: AiAction[]): AppliedAiActions {
  let next: ApiRequest = structuredClone(request)
  const applied: AiAction[] = []
  const skipped: AppliedAiActions['skipped'] = []
  const skip = (action: AiAction, reason: string): void => {
    skipped.push({ action, reason })
  }

  for (const action of actions) {
    switch (action.type) {
      case 'set_method': {
        const method = action.value?.toUpperCase() as HttpMethod | undefined
        if (!method || !HTTP_METHODS.includes(method)) {
          skip(action, `unknown method ${action.value ?? ''}`)
          continue
        }
        next.method = method
        break
      }
      case 'set_url': {
        if (!action.value) {
          skip(action, 'empty URL')
          continue
        }
        next.url = action.value
        break
      }
      case 'set_body': {
        const bodyType = action.bodyType ?? 'json'
        if (bodyType === 'none') {
          next.body = { ...next.body, mode: 'none' }
          break
        }
        let content = action.value ?? ''
        if (bodyType === 'json') {
          try {
            content = JSON.stringify(JSON.parse(content), null, 2)
          } catch {
            // Keep the model's text when it contains {{variables}} that are not valid JSON on their own.
          }
        }
        next.body = { ...next.body, mode: 'raw', rawType: RAW_TYPES[bodyType], content }
        break
      }
      case 'upsert_header':
        if (!action.key) {
          skip(action, 'missing header name')
          continue
        }
        next.headers = upsert(next.headers, action.key, action.value ?? '', action.enabled)
        break
      case 'remove_header':
        if (!action.key || !next.headers.some((row) => row.key.toLowerCase() === action.key!.toLowerCase())) {
          skip(action, `header ${action.key ?? ''} not found`)
          continue
        }
        next.headers = remove(next.headers, action.key)
        break
      case 'upsert_param':
        if (!action.key) {
          skip(action, 'missing param name')
          continue
        }
        next.params = upsert(next.params, action.key, action.value ?? '', action.enabled)
        break
      case 'remove_param': {
        const key = action.key
        const inUrl = Boolean(key && removeFromQueryString(next.url, key) !== next.url)
        if (!key || (!inUrl && !next.params.some((row) => row.key.toLowerCase() === key.toLowerCase()))) {
          skip(action, `param ${key ?? ''} not found`)
          continue
        }
        next.params = remove(next.params, key)
        next.url = removeFromQueryString(next.url, key)
        break
      }
      case 'set_auth': {
        const type = action.authType ?? 'none'
        const auth = { ...next.auth, type }
        if (type === 'bearer') auth.token = action.value ?? ''
        if (type === 'basic') {
          auth.username = action.key ?? ''
          auth.password = action.value ?? ''
        }
        if (type === 'api-key') {
          auth.apiKeyName = action.key ?? 'X-API-Key'
          auth.apiKeyValue = action.value ?? ''
        }
        next.auth = auth
        break
      }
      case 'curl':
        // Not an edit: shown to the user as a copyable command.
        continue
    }
    applied.push(action)
  }

  if (applied.length) next = { ...next, updatedAt: nowIso() }
  return { request: next, applied, skipped }
}

export function isEditAction(action: AiAction): boolean {
  return action.type !== 'curl'
}
