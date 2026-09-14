import { describe, expect, it } from 'vitest'
import { detectResponseFormat, displayResponseText } from './response-format'

describe('response formats', () => {
  it('detects a format from content type and falls back to valid JSON', () => {
    expect(detectResponseFormat('text/html; charset=UTF-8', '<h1>Hello</h1>')).toBe('HTML')
    expect(detectResponseFormat('application/xml', '<root/>')).toBe('XML')
    expect(detectResponseFormat('text/plain', '{"ok":true}')).toBe('JSON')
    expect(detectResponseFormat('text/plain', 'plain text')).toBe('Raw')
  })

  it('formats JSON and encodes the displayed text without changing the source', () => {
    const body = '{"name":"ação"}'
    expect(displayResponseText(body, 'JSON')).toContain('\n  "name": "ação"\n')
    expect(displayResponseText('Olá', 'Hex')).toContain('4f 6c c3 a1')
    expect(displayResponseText('Olá', 'Base64')).toBe('T2zDoQ==')
    expect(displayResponseText(body, 'Raw')).toBe(body)
  })

  it('leaves invalid JSON untouched when manually selected', () => {
    expect(displayResponseText('{broken', 'JSON')).toBe('{broken')
  })
})
