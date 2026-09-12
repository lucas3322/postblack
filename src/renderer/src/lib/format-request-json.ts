export type JsonFormatResult = { ok: true; value: string } | { ok: false; message: string }

export function formatRequestJson(source: string): JsonFormatResult {
  try {
    JSON.parse(source)
    return { ok: true, value: indentJson(source) }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.'
    }
  }
}

function indentJson(source: string): string {
  const output: string[] = []
  const emptyContainers: boolean[] = []
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (inString) {
      output.push(character)
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }

    if (character === '"') {
      inString = true
      output.push(character)
    } else if (character === '{' || character === '[') {
      output.push(character)
      depth += 1
      let nextIndex = index + 1
      while (nextIndex < source.length && /\s/.test(source[nextIndex])) nextIndex += 1
      const next = source[nextIndex]
      const empty = next === (character === '{' ? '}' : ']')
      emptyContainers.push(empty)
      if (!empty) output.push('\n', '  '.repeat(depth))
    } else if (character === '}' || character === ']') {
      depth -= 1
      if (!emptyContainers.pop()) output.push('\n', '  '.repeat(depth))
      output.push(character)
    } else if (character === ',') {
      output.push(',\n', '  '.repeat(depth))
    } else if (character === ':') {
      output.push(': ')
    } else if (!/\s/.test(character)) {
      output.push(character)
    }
  }

  return output.join('')
}
