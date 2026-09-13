import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { JsonBodyEditor } from './JsonBodyEditor'

describe('JSON request body editor', () => {
  it('colors keys and values while leaving the editable source unchanged', () => {
    const source = '{\n  "cnpj": "",\n  "active": true,\n  "count": 2\n}'
    const html = renderToString(<JsonBodyEditor value={source} onChange={() => undefined} />)

    expect(html).toContain('json-key')
    expect(html).toContain('json-string')
    expect(html).toContain('json-boolean')
    expect(html).toContain('json-number')
    expect(html).toContain('aria-label="JSON request body"')
    expect(html).toContain('<textarea')
    expect(html).toContain('Beautify')
    expect(html).toContain('&quot;cnpj&quot;: &quot;&quot;')
  })

  it('keeps large bodies editable without building thousands of highlight elements', () => {
    const source = JSON.stringify(Array.from({ length: 5_000 }, (_, id) => ({ id })))
    const html = renderToString(<JsonBodyEditor value={source} onChange={() => undefined} />)

    expect(html).toContain('<textarea')
    expect(html).toContain('Highlighting paused for a large body')
    expect(html).not.toContain('json-key')
  })

  it('highlights known and missing references inside a JSON string without changing the body', () => {
    const source = '{"url":"{{base_url}}/users/{{missing}}"}'
    const html = renderToString(
      <JsonBodyEditor
        value={source}
        variableDetails={{ base_url: { value: 'https://example.com', secret: false, scope: 'global' } }}
        onChange={() => undefined}
      />
    )

    expect(html).toContain('url-variable-known')
    expect(html).toContain('url-variable-missing')
    expect(html).toContain('value')
    expect(html).toContain('{{base_url}}')
  })

  it('highlights references in plain text mode and does not show JSON formatting controls', () => {
    const html = renderToString(
      <JsonBodyEditor
        syntax="plain"
        value={'token={{token}}'}
        variableDetails={{ token: { value: 'secret', secret: true, scope: 'workspace' } }}
        onChange={() => undefined}
      />
    )

    expect(html).toContain('url-variable-known')
    expect(html).not.toContain('Beautify')
    expect(html).toContain('aria-label="Request body"')
  })
})
