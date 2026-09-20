import { describe, expect, it } from 'vitest'
import { findTextMatches, moveTextMatch } from './body-search'

describe('body search', () => {
  it('finds all occurrences without changing the body', () => {
    const source = '{"name":"Lucas","owner":"lucas"}'

    expect(findTextMatches(source, 'lucas')).toEqual([
      { start: 9, end: 14 },
      { start: 25, end: 30 }
    ])
    expect(source).toBe('{"name":"Lucas","owner":"lucas"}')
  })

  it('supports case-sensitive search', () => {
    expect(findTextMatches('Token token TOKEN', 'Token', true)).toEqual([{ start: 0, end: 5 }])
  })

  it('keeps offsets in the original text and searches regex characters literally', () => {
    expect(findTextMatches('İ foo [.*] FOO', 'foo')).toEqual([
      { start: 2, end: 5 },
      { start: 11, end: 14 }
    ])
    expect(findTextMatches('foo [.*] bar', '[.*]')).toEqual([{ start: 4, end: 8 }])
  })

  it('wraps when moving through results', () => {
    expect(moveTextMatch(2, 3, 1)).toBe(0)
    expect(moveTextMatch(0, 3, -1)).toBe(2)
    expect(moveTextMatch(0, 0, 1)).toBe(0)
  })
})
