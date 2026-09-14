import { describe, expect, it } from 'vitest'
import { createKeyValue } from '../../../shared/domain'
import { responseCookies } from './response-cookies'

describe('response cookies', () => {
  it('reads separate and combined Set-Cookie headers without splitting an Expires date', () => {
    const headers = [
      createKeyValue('set-cookie', 'session=abc; Path=/; HttpOnly; Secure; SameSite=Lax'),
      createKeyValue(
        'Set-Cookie',
        'theme=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT, language=pt-BR; Path=/'
      )
    ]

    expect(responseCookies(headers)).toMatchObject([
      { name: 'session', value: 'abc', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: 'theme', expires: 'Wed, 21 Oct 2026 07:28:00 GMT' },
      { name: 'language', value: 'pt-BR', path: '/' }
    ])
  })
})
