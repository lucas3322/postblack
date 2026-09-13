import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthValueInput } from './AuthValueInput'

const variableDetails = {
  token: { value: 'private-token', secret: true, scope: 'environment' as const }
}

describe('auth variable input', () => {
  it('colors a complete reference without rendering its secret value', () => {
    const html = renderToString(
      <AuthValueInput value="{{token}}" secret variableDetails={variableDetails} onChange={() => undefined} />
    )

    expect(html).toContain('url-variable-known')
    expect(html).toContain('type="text"')
    expect(html).not.toContain('private-token')
  })

  it('keeps literal credentials masked', () => {
    const html = renderToString(
      <AuthValueInput
        value="private-token"
        secret
        variableDetails={variableDetails}
        onChange={() => undefined}
      />
    )

    expect(html).toContain('type="password"')
    expect(html).not.toContain('url-variable-known')
  })
})
