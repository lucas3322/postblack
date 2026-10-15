import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MiniMarkdown, parseMarkdown } from './mini-markdown'

describe('parseMarkdown', () => {
  it('splits code fences, headings, lists and paragraphs', () => {
    expect(
      parseMarkdown('## Resumo\nStatus **200**.\n\n- um\n- dois\n\n```bash\ncurl x \\\n  -H a\n```\nfim')
    ).toEqual([
      { kind: 'heading', level: 2, text: 'Resumo' },
      { kind: 'paragraph', text: 'Status **200**.' },
      { kind: 'list', ordered: false, items: ['um', 'dois'] },
      { kind: 'code', language: 'bash', text: 'curl x \\\n  -H a' },
      { kind: 'paragraph', text: 'fim' }
    ])
  })

  it('keeps an unterminated fence as code', () => {
    expect(parseMarkdown('```json\n{"a":1}')).toEqual([{ kind: 'code', language: 'json', text: '{"a":1}' }])
  })
})

describe('MiniMarkdown', () => {
  it('escapes HTML instead of rendering it', () => {
    const html = renderToString(
      <MiniMarkdown source={'<img src=x onerror=alert(1)> `code`'} renderCode={(text) => <pre>{text}</pre>} />
    )
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).toContain('<code>code</code>')
  })
})
