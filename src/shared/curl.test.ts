import { describe, expect, it } from 'vitest'
import { generateCurl, importCurl, isCurlCommand } from './curl'
import { createKeyValue, createRequest } from './domain'

describe('cURL conversion', () => {
  it('imports method, headers, JSON body, and variables', () => {
    const command =
      "curl --request POST '{{base_url}}/users' --header 'Content-Type: application/json' --header 'Authorization: Bearer {{token}}' --data-raw '{\"name\":\"Ada\"}'"
    const result = importCurl(command)

    expect(result.request.method).toBe('POST')
    expect(result.request.url).toBe('{{base_url}}/users')
    expect(result.request.auth.type).toBe('bearer')
    expect(result.request.auth.token).toBe('{{token}}')
    expect(result.request.body.mode).toBe('raw')
    expect(result.request.body.rawType).toBe('json')
    expect(result.request.body.content).toBe('{"name":"Ada"}')
    expect(result.warnings).toEqual([])
  })

  it('generates a runnable command with resolved variables', () => {
    const request = createRequest('Create user')
    request.method = 'POST'
    request.url = '{{base_url}}/users'
    request.headers = [createKeyValue('X-Client', 'postblack desktop')]
    request.body = { mode: 'json', content: '{"active":true}' }

    const command = generateCurl(request, { base_url: 'https://api.example.com' })

    expect(command).toContain('https://api.example.com/users')
    expect(command).toContain("'X-Client: postblack desktop'")
    expect(command).toContain('--data-raw \'{"active":true}\'')
  })

  it('imports rendered Markdown cURL and separates query parameters', () => {
    const command =
      "curl --location '[http://127.0.0.1:3012/api/v1/compras/list?page=1&paginate=true&per\\_page=10](http://127.0.0.1:3012/api/v1/compras/list?page=1\\&paginate=true\\&per_page=10)' \\--header 'Accept: application/json, text/plain, */*' \\--header 'Authorization: Bearer test-token' \\--header 'Origin: [http://localhost:3013](http://localhost:3013)'"

    const result = importCurl(command)

    expect(result.request.url).toBe('http://127.0.0.1:3012/api/v1/compras/list')
    expect(result.request.params.map(({ key, value }) => [key, value])).toEqual([
      ['page', '1'],
      ['paginate', 'true'],
      ['per_page', '10']
    ])
    expect(result.request.auth.type).toBe('bearer')
    expect(result.request.auth.token).toBe('test-token')
    expect(result.request.headers).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'Origin', value: 'http://localhost:3013' })])
    )
    expect(result.warnings).toEqual([])
  })

  it('distinguishes complete cURL commands from ordinary URLs', () => {
    expect(isCurlCommand('  curl --location https://example.com')).toBe(true)
    expect(isCurlCommand('https://example.com')).toBe(false)
  })

  it('imports and generates multipart file fields', () => {
    const imported = importCurl(
      "curl https://example.com/upload --form 'title=Document' --form 'file=@/tmp/report.pdf'"
    )

    expect(imported.request.body.mode).toBe('form-data')
    expect(imported.request.body.formData).toEqual([
      expect.objectContaining({ key: 'title', value: 'Document', type: 'text' }),
      expect.objectContaining({
        key: 'file',
        type: 'file',
        file: expect.objectContaining({ name: 'report.pdf' })
      })
    ])

    const generated = generateCurl(imported.request)
    expect(generated).toContain('--form title=Document')
    expect(generated).toContain('--form file=@/tmp/report.pdf')
  })

  it('generates GraphQL payloads with resolved variables', () => {
    const request = createRequest('GraphQL')
    request.method = 'POST'
    request.url = 'https://example.com/graphql'
    request.body.mode = 'graphql'
    request.body.graphql = { query: 'query { user(id: "{{id}}") { name } }', variables: '{}' }

    const command = generateCurl(request, { id: '42' })

    expect(command).toContain('query { user(id: \\"42\\") { name } }')
    expect(command).toContain('"variables":{}')
  })
})
