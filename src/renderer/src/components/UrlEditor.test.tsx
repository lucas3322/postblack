import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UrlEditor } from './UrlEditor'

describe('URL editor', () => {
  it('colors defined variables differently from missing variables without changing the editable URL', () => {
    const url = '{{base_url}}/users/{{missing}}'
    const html = renderToString(
      <UrlEditor
        value={url}
        variableNames={['base_url']}
        variableDetails={{ base_url: { value: 'https://example.com', secret: false, scope: 'workspace' } }}
        importingCurl={false}
        sending={false}
        onChange={() => undefined}
        onPaste={() => undefined}
        onSend={() => undefined}
        onOpenVariables={() => undefined}
      />
    )

    expect(html).toContain('url-variable-known')
    expect(html).toContain('url-variable-missing')
    expect(html).toContain('Insert variable in URL')
    expect(html).toContain('Manage variables')
    expect(html).toContain(`value="${url}"`)
  })
})
