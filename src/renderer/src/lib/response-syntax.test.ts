import { describe, expect, it } from 'vitest'
import { tokenizeResponseText } from './response-syntax'

describe('response syntax', () => {
  it('colors HTML tags and JavaScript in a Laravel dump while preserving text', () => {
    const source = '<script>const message = "SQLSTATE";</script>'
    const tokens = tokenizeResponseText(source, 'HTML') ?? []
    expect(tokens.map((token) => token.value).join('')).toBe(source)
    expect(tokens.some((token) => token.kind === 'tag')).toBe(true)
    expect(tokens.some((token) => token.kind === 'keyword')).toBe(true)
    expect(tokens.some((token) => token.kind === 'string')).toBe(true)
  })

  it('keeps raw and encoded modes without syntax tokens', () => {
    expect(tokenizeResponseText('<b>test</b>', 'Raw')).toBeNull()
    expect(tokenizeResponseText('00 ff', 'Hex')).toBeNull()
  })
})
