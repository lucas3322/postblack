import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFormDataEntry, createKeyValue, createRequest } from '../shared/domain'
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
            contentType: request.headers['content-type'],
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

  it('sends x-www-form-urlencoded rows with resolved variables', async () => {
    const request = createRequest('Form request')
    request.method = 'POST'
    request.url = `${baseUrl}/form`
    request.body.mode = 'form-urlencoded'
    request.body.urlEncoded = [createKeyValue('name', '{{name}}'), createKeyValue('active', 'true')]

    const result = await executeHttpRequest({ request, variables: { name: 'Lucas Pardinho' } })
    const body = JSON.parse(result.body) as Record<string, string>

    expect(body.contentType).toContain('application/x-www-form-urlencoded')
    expect(body.body).toBe('name=Lucas+Pardinho&active=true')
  })

  it('sends GraphQL query and variables as JSON', async () => {
    const request = createRequest('GraphQL request')
    request.method = 'POST'
    request.url = `${baseUrl}/graphql`
    request.body.mode = 'graphql'
    request.body.graphql = {
      query: 'query User($id: ID!) { user(id: $id) { name } }',
      variables: '{"id":"{{user_id}}"}'
    }

    const result = await executeHttpRequest({ request, variables: { user_id: '42' } })
    const response = JSON.parse(result.body) as Record<string, string>
    const sent = JSON.parse(response.body) as { query: string; variables: { id: string } }

    expect(response.contentType).toContain('application/json')
    expect(sent.query).toContain('query User')
    expect(sent.variables).toEqual({ id: '42' })
  })

  it('sends text and file fields as multipart form-data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postblack-upload-test-'))
    const filePath = join(directory, 'sample.txt')
    await writeFile(filePath, 'arquivo-postblack')
    try {
      const request = createRequest('Upload request')
      request.method = 'POST'
      request.url = `${baseUrl}/upload`
      request.body.mode = 'form-data'
      const textEntry = createFormDataEntry('description', '{{description}}')
      const fileEntry = createFormDataEntry('document')
      fileEntry.type = 'file'
      fileEntry.file = { path: filePath, name: 'sample.txt', size: 17, mimeType: 'text/plain' }
      request.body.formData = [textEntry, fileEntry]

      const result = await executeHttpRequest({ request, variables: { description: 'Contrato' } })
      const body = JSON.parse(result.body) as Record<string, string>

      expect(body.contentType).toContain('multipart/form-data; boundary=')
      expect(body.body).toContain('name="description"')
      expect(body.body).toContain('Contrato')
      expect(body.body).toContain('filename="sample.txt"')
      expect(body.body).toContain('arquivo-postblack')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('sends a selected file as a binary body', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'postblack-binary-test-'))
    const filePath = join(directory, 'payload.bin')
    await writeFile(filePath, 'binary-content')
    try {
      const request = createRequest('Binary request')
      request.method = 'POST'
      request.url = `${baseUrl}/binary`
      request.body.mode = 'binary'
      request.body.binaryFile = {
        path: filePath,
        name: 'payload.bin',
        size: 14,
        mimeType: 'application/octet-stream'
      }

      const result = await executeHttpRequest({ request, variables: {} })
      const body = JSON.parse(result.body) as Record<string, string>

      expect(body.contentType).toContain('application/octet-stream')
      expect(body.body).toBe('binary-content')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
