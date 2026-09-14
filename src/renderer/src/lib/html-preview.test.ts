import { describe, expect, it } from 'vitest'
import { sandboxedHtmlDocument } from './html-preview'

describe('HTML response preview', () => {
  it('preserves Laravel dump markup while injecting an isolated content policy', () => {
    const html =
      '<!doctype html><html><head><style>.sf-dump{color:green}</style></head><body><pre class="sf-dump">SQLSTATE</pre><script>window.Sfdump = 1</script></body></html>'
    const preview = sandboxedHtmlDocument(html)

    expect(preview).toContain('class="sf-dump"')
    expect(preview).toContain('SQLSTATE')
    expect(preview).toContain("script-src 'unsafe-inline'")
    expect(preview).toContain("connect-src 'none'")
    expect(preview.indexOf('Content-Security-Policy')).toBeLessThan(preview.indexOf('<style>'))
  })
})
