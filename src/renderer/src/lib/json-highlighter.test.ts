import { describe, expect, it } from 'vitest'
import { tokenizeJson } from './json-highlighter'

describe('JSON highlighter', () => {
  it('distinguishes keys and all JSON value types', () => {
    const tokens = tokenizeJson('{"message":"hello","count":42,"price":10.5,"active":false,"result":null}')

    expect(tokens.filter((token) => token.kind === 'key').map((token) => token.value)).toEqual([
      '"message"',
      '"count"',
      '"price"',
      '"active"',
      '"result"'
    ])
    expect(tokens).toEqual(expect.arrayContaining([{ kind: 'string', value: '"hello"' }]))
    expect(tokens).toEqual(expect.arrayContaining([{ kind: 'number', value: '42' }]))
    expect(tokens).toEqual(expect.arrayContaining([{ kind: 'number', value: '10.5' }]))
    expect(tokens).toEqual(expect.arrayContaining([{ kind: 'boolean', value: 'false' }]))
    expect(tokens).toEqual(expect.arrayContaining([{ kind: 'null', value: 'null' }]))
  })

  it('keeps escaped quotes inside string values', () => {
    const tokens = tokenizeJson('{"message":"say \\"hello\\""}')
    expect(tokens.find((token) => token.kind === 'string')?.value).toBe('"say \\"hello\\""')
  })
})
