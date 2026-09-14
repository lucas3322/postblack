export const RESPONSE_FORMATS = [
  'JSON',
  'XML',
  'HTML',
  'YAML',
  'JavaScript',
  'Markdown',
  'Raw',
  'Hex',
  'Base64'
] as const

export type ResponseFormat = (typeof RESPONSE_FORMATS)[number]

export function detectResponseFormat(contentType: string, body: string): ResponseFormat {
  const mime = contentType.split(';', 1)[0].trim().toLowerCase()
  if (mime.includes('json')) return 'JSON'
  if (mime.includes('html')) return 'HTML'
  if (mime.includes('xml')) return 'XML'
  if (mime.includes('yaml') || mime.includes('yml')) return 'YAML'
  if (mime.includes('javascript') || mime.includes('ecmascript')) return 'JavaScript'
  if (mime.includes('markdown')) return 'Markdown'
  if (/^\s*[\[{]/.test(body) && isValidJson(body)) return 'JSON'
  return 'Raw'
}

export function displayResponseText(body: string, format: ResponseFormat): string {
  if (format === 'Hex') return toHex(body)
  if (format === 'Base64') return toBase64(body)
  if (format !== 'JSON') return body

  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function isValidJson(body: string): boolean {
  try {
    JSON.parse(body)
    return true
  } catch {
    return false
  }
}

function toHex(body: string): string {
  const bytes = new TextEncoder().encode(body)
  const lines: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16)
    lines.push(
      `${offset.toString(16).padStart(8, '0')}  ${Array.from(chunk, (byte) => byte.toString(16).padStart(2, '0')).join(' ')}`
    )
  }
  return lines.join('\n')
}

function toBase64(body: string): string {
  const bytes = new TextEncoder().encode(body)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}
