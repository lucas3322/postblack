import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createKeyValue, createRequest } from '../shared/domain'
import { responseCookies } from '../renderer/src/lib/response-cookies'
import { executeHttpRequest } from './http-executor'

describe('HTTP executor', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Set-Cookie', ['session=abc; HttpOnly; Path=/', 'theme=dark; Path=/'])
        response.end(
          JSON.stringify({
            method: request.method,
            url: request.url,
            authorization: request.headers.authorization,
            body: Buffer.concat(chunks).toString('utf8')
          })
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Could not start test server.')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it('resolves variables and returns real response metadata', async () => {
    const request = createRequest('Create resource')
    request.method = 'POST'
    request.url = '{{base_url}}/resources'
    request.params = [createKeyValue('page', '{{page}}')]
    request.auth = { ...request.auth, type: 'bearer', token: '{{token}}' }
    request.body = { mode: 'json', content: '{"name":"{{name}}"}' }

    const result = await executeHttpRequest({
      request,
      variables: { base_url: baseUrl, page: '2', token: 'secret-token', name: 'Postblack' }
    })
    const body = JSON.parse(result.body) as Record<string, string>

    expect(result.status).toBe(200)
    expect(result.contentType).toContain('application/json')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(responseCookies(result.headers).map((cookie) => cookie.name)).toEqual(['session', 'theme'])
    expect(body.method).toBe('POST')
    expect(body.url).toBe('/resources?page=2')
    expect(body.authorization).toBe('Bearer secret-token')
    expect(body.body).toBe('{"name":"Postblack"}')
  })

  it('does not send an unresolved or empty bearer variable', async () => {
    const request = createRequest('Protected resource')
    request.url = `${baseUrl}/protected`
    request.auth = { ...request.auth, type: 'bearer', token: '{{access_token}}' }

    await expect(executeHttpRequest({ request, variables: {} })).rejects.toThrow(
      'Bearer token variable {{access_token}} not found'
    )
    await expect(executeHttpRequest({ request, variables: { access_token: '' } })).rejects.toThrow(
      'Bearer token is empty'
    )
  })
})
