import { tokenizeJson, type JsonToken } from './json-highlighter'

export const LARGE_RESPONSE_THRESHOLD = 50_000
export const RESPONSE_LINE_HEIGHT = 18
export const RESPONSE_LINE_OVERSCAN = 12

export interface PreparedResponseBody {
  text: string
  isJson: boolean
  tokens: JsonToken[] | null
  lineStarts: number[] | null
}

export function prepareResponseBody(body: string): PreparedResponseBody {
  let text = body
  let isJson = false

  try {
    text = JSON.stringify(JSON.parse(body), null, 2)
    isJson = true
  } catch {
    // Non-JSON responses should remain exactly as received.
  }

  if (text.length > LARGE_RESPONSE_THRESHOLD) {
    return { text, isJson, tokens: null, lineStarts: collectLineStarts(text) }
  }

  return { text, isJson, tokens: isJson ? tokenizeJson(text) : null, lineStarts: null }
}

export function collectLineStarts(text: string): number[] {
  const starts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) starts.push(index + 1)
  }
  return starts
}

export function lineText(text: string, starts: number[], index: number): string {
  const end = index + 1 < starts.length ? starts[index + 1] - 1 : text.length
  return text.slice(starts[index], end)
}

export function lineIndexAtOffset(starts: number[], offset: number): number {
  let low = 0
  let high = starts.length - 1

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (starts[middle] <= offset) low = middle
    else high = middle - 1
  }

  return low
}

export function findNextMatch(text: string, query: string, previousOffset: number | null): number | null {
  if (!query) return null
  const source = text.toLowerCase()
  const search = query.toLowerCase()
  const nextStart = previousOffset === null ? 0 : previousOffset + search.length
  const next = source.indexOf(search, nextStart)
  if (next >= 0) return next
  const wrapped = source.indexOf(search)
  return wrapped >= 0 ? wrapped : null
}

export function visibleLineRange(
  lineCount: number,
  scrollTop: number,
  viewportHeight: number
): { start: number; end: number } {
  const firstVisible = Math.max(0, Math.floor(scrollTop / RESPONSE_LINE_HEIGHT))
  const visibleCount = Math.ceil(viewportHeight / RESPONSE_LINE_HEIGHT)
  return {
    start: Math.max(0, firstVisible - RESPONSE_LINE_OVERSCAN),
    end: Math.min(lineCount, firstVisible + visibleCount + RESPONSE_LINE_OVERSCAN)
  }
}
