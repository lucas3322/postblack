import { tokenizeJson } from './json-highlighter'
import type { ResponseFormat } from './response-format'

export interface ResponseToken {
  kind: string
  value: string
}

const TOKEN_PATTERN =
  /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|<\/?[A-Za-z][^>\n]*?>|\/\/[^\n]*|^#{1,6}[^\n]*|\*\*[^*\n]+\*\*|`[^`\n]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|async|await|class|new|true|false|null|undefined|throw|try|catch|import|export|from)\b|\b\d+(?:\.\d+)?\b|^[ \t-]*[\w.-]+(?=[ \t]*:)/gm
const MAX_TOKENIZED_CHARS = 25_000

export function tokenizeResponseText(text: string, format: ResponseFormat): ResponseToken[] | null {
  if (format === 'Raw' || format === 'Hex' || format === 'Base64') return null
  if (format === 'JSON') return tokenizeJson(text)

  const source = text.slice(0, MAX_TOKENIZED_CHARS)
  const tokens: ResponseToken[] = []
  let cursor = 0

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    if (match.index > cursor) tokens.push({ kind: 'plain', value: source.slice(cursor, match.index) })
    const value = match[0]
    tokens.push({ kind: classify(value, format), value })
    cursor = match.index + value.length
  }

  if (cursor < source.length) tokens.push({ kind: 'plain', value: source.slice(cursor) })
  if (source.length < text.length) tokens.push({ kind: 'plain', value: text.slice(source.length) })
  return tokens
}

export function responseTokenClass(format: ResponseFormat, kind: string): string {
  return `${format === 'JSON' ? 'json' : 'syntax'}-${kind}`
}

function classify(value: string, format: ResponseFormat): string {
  if (value.startsWith('<!--') || value.startsWith('//') || value.startsWith('/*')) return 'comment'
  if (value.startsWith('<')) return 'tag'
  if (format === 'Markdown' && (value.startsWith('#') || value.startsWith('**'))) return 'heading'
  if (format === 'Markdown' && value.startsWith('`')) return 'string'
  if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) return 'string'
  if (/^\d/.test(value)) return 'number'
  if (format === 'YAML' && /:$/.test(value)) return 'key'
  if (format === 'YAML' && /^[ \t-]*[\w.-]+$/.test(value)) return 'key'
  return 'keyword'
}
