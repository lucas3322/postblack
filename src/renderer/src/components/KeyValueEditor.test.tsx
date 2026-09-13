import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createKeyValue } from '../../../shared/domain'
import { KeyValueEditor } from './KeyValueEditor'

describe('request key-value editor', () => {
  it('colors references in header values and leaves the editable value unchanged', () => {
    const row = createKeyValue('application-key', '{{application_key}}')
    const html = renderToString(
      <KeyValueEditor
        rows={[row]}
        onChange={() => undefined}
        keyPlaceholder="Header"
        variableNames={['application_key']}
        variableDetails={{ application_key: { value: 'secret', secret: true, scope: 'environment' } }}
      />
    )

    expect(html).toContain('url-variable-known')
    expect(html).toContain('variable-value-input')
    expect(html).toContain('value="{{application_key}}"')
  })

  it('does not expose variable suggestions inside the variables management editor', () => {
    const html = renderToString(
      <KeyValueEditor rows={[createKeyValue('token', 'secret')]} secretValues onChange={() => undefined} />
    )

    expect(html).not.toContain('variable-value-input')
    expect(html).toContain('type="password"')
  })
})
