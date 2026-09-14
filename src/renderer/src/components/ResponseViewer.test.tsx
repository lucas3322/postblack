import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ResponseSnapshot } from '../../../shared/domain'
import { ResponseViewer } from './ResponseViewer'

function snapshot(body: string): ResponseSnapshot {
  return {
    id: 'response-1',
    requestId: 'request-1',
    requestName: 'Large request',
    method: 'GET',
    url: 'https://example.test/data',
    status: 200,
    statusText: 'OK',
    durationMs: 100,
    sizeBytes: body.length,
    headers: [],
    body,
    contentType: 'application/json',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('ResponseViewer', () => {
  it('renders a bounded number of highlighted lines for a large JSON body', () => {
    const body = JSON.stringify(Array.from({ length: 60_000 }, (_, id) => ({ id, active: true })))
    const html = renderToString(<ResponseViewer response={snapshot(body)} sending={false} />)

    expect(html).toContain('response-body-virtual')
    expect(html).toContain('json-key')
    expect(html).toContain('json-number')
    expect(html).toContain('Copy body')
    expect(html).toContain('Find in complete response')
    expect((html.match(/class="json-/g) ?? []).length).toBeLessThan(1_000)
    expect(html.length).toBeLessThan(100_000)
    expect(html).not.toContain('"id": 3999')
  })

  it('offers response formats and an HTML preview for a Laravel dump', () => {
    const response = snapshot('<pre class="sf-dump">SQLSTATE</pre>')
    response.contentType = 'text/html; charset=UTF-8'
    const html = renderToString(<ResponseViewer response={response} sending={false} />)

    expect(html).toContain('aria-label="Response body format"')
    expect(html).toContain('value="HTML" selected=""')
    expect(html).toContain('Preview')
    expect(html).toContain('syntax-tag')
    expect(html).toContain('SQLSTATE')
  })
})
