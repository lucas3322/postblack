import { describe, expect, it } from 'vitest'
import {
  collectLineStarts,
  findNextMatch,
  LARGE_RESPONSE_THRESHOLD,
  lineIndexAtOffset,
  lineText,
  prepareResponseBody,
  visibleLineRange
} from './response-body'

describe('response body preparation', () => {
  it('keeps syntax colors for small JSON responses', () => {
    const prepared = prepareResponseBody('{"ok":true}')
    expect(prepared.text).toBe('{\n  "ok": true\n}')
    expect(prepared.tokens?.some((token) => token.kind === 'boolean')).toBe(true)
    expect(prepared.lineStarts).toBeNull()
  })

  it('does not allocate tokens for a large response', () => {
    const prepared = prepareResponseBody(JSON.stringify(Array.from({ length: 4_000 }, (_, id) => ({ id }))))
    expect(prepared.text.length).toBeGreaterThan(LARGE_RESPONSE_THRESHOLD)
    expect(prepared.isJson).toBe(true)
    expect(prepared.tokens).toBeNull()
    expect(prepared.lineStarts?.length).toBeGreaterThan(4_000)
  })

  it('preserves non-JSON text and indexes final empty lines', () => {
    const text = 'first\nsecond\n'
    const prepared = prepareResponseBody(text)
    const starts = collectLineStarts(prepared.text)
    expect(prepared.text).toBe(text)
    expect(prepared.isJson).toBe(false)
    expect(starts.map((_, index) => lineText(text, starts, index))).toEqual(['first', 'second', ''])
    expect(lineIndexAtOffset(starts, 7)).toBe(1)
    expect(lineIndexAtOffset(starts, text.length)).toBe(2)
  })

  it('limits the visible range and clamps it at document edges', () => {
    expect(visibleLineRange(1_000, 0, 180)).toEqual({ start: 0, end: 22 })
    expect(visibleLineRange(1_000, 9_000, 180)).toEqual({ start: 488, end: 522 })
    expect(visibleLineRange(1_000, 18_000, 180)).toEqual({ start: 988, end: 1_000 })
  })

  it('finds text outside the visible range and wraps to the first match', () => {
    const text = 'one\ntwo\nONE'
    expect(findNextMatch(text, 'one', null)).toBe(0)
    expect(findNextMatch(text, 'one', 0)).toBe(8)
    expect(findNextMatch(text, 'one', 8)).toBe(0)
    expect(findNextMatch(text, 'missing', null)).toBeNull()
  })
})
