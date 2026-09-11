export type JsonTokenKind =
  'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace' | 'plain'

export interface JsonToken {
  kind: JsonTokenKind
  value: string
}

export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = []
  let position = 0

  while (position < source.length) {
    const character = source[position]

    if (/\s/.test(character)) {
      const end = consumeWhile(source, position, (value) => /\s/.test(value))
      tokens.push({ kind: 'whitespace', value: source.slice(position, end) })
      position = end
      continue
    }

    if (character === '"') {
      const end = consumeJsonString(source, position)
      const kind = /^\s*:/.test(source.slice(end)) ? 'key' : 'string'
      tokens.push({ kind, value: source.slice(position, end) })
      position = end
      continue
    }

    const number = source.slice(position).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    if (number) {
      tokens.push({ kind: 'number', value: number[0] })
      position += number[0].length
      continue
    }

    const literal = source.slice(position).match(/^(true|false|null)/)
    if (literal) {
      tokens.push({ kind: literal[0] === 'null' ? 'null' : 'boolean', value: literal[0] })
      position += literal[0].length
      continue
    }

    if ('{}[],:'.includes(character)) {
      tokens.push({ kind: 'punctuation', value: character })
    } else {
      tokens.push({ kind: 'plain', value: character })
    }
    position += 1
  }

  return tokens
}

function consumeWhile(source: string, start: number, predicate: (value: string) => boolean): number {
  let position = start
  while (position < source.length && predicate(source[position])) position += 1
  return position
}

function consumeJsonString(source: string, start: number): number {
  let position = start + 1
  let escaped = false

  while (position < source.length) {
    const character = source[position]
    position += 1

    if (escaped) {
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character === '"') {
      break
    }
  }

  return position
}
