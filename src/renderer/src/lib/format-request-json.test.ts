import { describe, expect, it } from 'vitest'
import { formatRequestJson } from './format-request-json'

describe('format request JSON', () => {
  it('beautifies nested JSON with two-space indentation without changing values', () => {
    const original = '{"name":"Lucas","items":[{"quantity":2,"active":true}],"empty":null}'
    const result = formatRequestJson(original)

    expect(result).toEqual({
      ok: true,
      value:
        '{\n  "name": "Lucas",\n  "items": [\n    {\n      "quantity": 2,\n      "active": true\n    }\n  ],\n  "empty": null\n}'
    })
  })

  it('returns a useful error for incomplete JSON, without producing replacement content', () => {
    const result = formatRequestJson('{"name":')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/^Invalid JSON:/)
  })

  it('preserves large numeric literals, duplicate keys, and escape spelling', () => {
    const original = '{"id":9007199254740993,"id":1,"path":"a\\/b","empty":{}}'
    const result = formatRequestJson(original)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('9007199254740993')
      expect(result.value.match(/"id"/g)).toHaveLength(2)
      expect(result.value).toContain('"a\\/b"')
      expect(result.value).toContain('"empty": {}')
    }
  })

  it('does not treat commas, braces, or escaped quotes inside strings as structure', () => {
    const original = '{"message":"value, {next} \\"quoted\\"","list":[[],{"done":false}]}'
    const result = formatRequestJson(original)

    expect(result).toEqual({
      ok: true,
      value:
        '{\n  "message": "value, {next} \\"quoted\\"",\n  "list": [\n    [],\n    {\n      "done": false\n    }\n  ]\n}'
    })
  })

  it('handles empty containers and primitive JSON values', () => {
    expect(formatRequestJson(' { "items" : [ ] } ')).toEqual({
      ok: true,
      value: '{\n  "items": []\n}'
    })
    expect(formatRequestJson(' true ')).toEqual({ ok: true, value: 'true' })
  })
})
