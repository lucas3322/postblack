import type { KeyValue } from '../../../shared/domain'

export interface ResponseCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: string
  sameSite: string
  httpOnly: boolean
  secure: boolean
}

export function responseCookies(headers: KeyValue[]): ResponseCookie[] {
  return headers
    .filter((header) => header.key.toLowerCase() === 'set-cookie')
    .flatMap((header) => header.value.split(/,(?=\s*[^=;,\s]+=)/))
    .slice(0, 200)
    .map(parseCookie)
    .filter((cookie): cookie is ResponseCookie => cookie !== null)
}

function parseCookie(source: string): ResponseCookie | null {
  const [pair, ...attributes] = source.split(';')
  const equals = pair.indexOf('=')
  if (equals <= 0) return null

  const cookie: ResponseCookie = {
    name: pair.slice(0, equals).trim(),
    value: pair.slice(equals + 1).trim(),
    domain: '',
    path: '',
    expires: '',
    sameSite: '',
    httpOnly: false,
    secure: false
  }

  for (const attribute of attributes) {
    const [rawName, ...rawValue] = attribute.trim().split('=')
    const name = rawName.toLowerCase()
    const value = rawValue.join('=').trim()
    if (name === 'domain') cookie.domain = value
    else if (name === 'path') cookie.path = value
    else if (name === 'expires') cookie.expires = value
    else if (name === 'samesite') cookie.sameSite = value
    else if (name === 'httponly') cookie.httpOnly = true
    else if (name === 'secure') cookie.secure = true
  }

  return cookie
}
