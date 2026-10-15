import { describe, expect, it } from 'vitest'
import { createWorkspace } from './domain'
import {
  importPostmanCollection,
  importPostmanEnvironment,
  isPostmanCollection,
  isPostmanEnvironment
} from './postman'
import { workspaceSchema } from './schemas'

const V21 = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

const collection = {
  info: { name: 'Loja API', schema: V21, description: { content: 'Endpoints da loja' } },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'base_url', value: 'https://api.loja.dev' },
    { key: 'token', secret: true }
  ],
  event: [{ listen: 'prerequest', script: { exec: ['console.log(1)'] } }],
  item: [
    {
      name: 'Health',
      request: { method: 'GET', header: [], url: '{{base_url}}/health' }
    },
    {
      name: 'Pedidos',
      item: [
        {
          name: 'Listar',
          request: {
            method: 'GET',
            header: [
              { key: 'Accept', value: 'application/json' },
              { key: 'X-Debug', value: '1', disabled: true }
            ],
            url: {
              raw: '{{base_url}}/pedidos?page=1&size=20',
              host: ['{{base_url}}'],
              path: ['pedidos'],
              query: [
                { key: 'page', value: '1' },
                { key: 'size', value: '20', disabled: true }
              ]
            }
          },
          response: [
            {
              name: 'Sucesso',
              code: 200,
              status: 'OK',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: '{"items":[]}'
            }
          ]
        },
        {
          name: 'Detalhe',
          item: [
            {
              name: 'Por id',
              request: {
                auth: { type: 'noauth' },
                method: 'GET',
                url: {
                  raw: '{{base_url}}/pedidos/:id',
                  variable: [{ key: 'id', value: '42' }]
                }
              }
            }
          ]
        },
        {
          name: 'Criar',
          event: [{ listen: 'test', script: { exec: ['pm.test()'] } }],
          request: {
            method: 'POST',
            auth: {
              type: 'apikey',
              apikey: [
                { key: 'key', value: 'X-Key' },
                { key: 'value', value: '{{key}}' }
              ]
            },
            body: { mode: 'raw', raw: '{\r\n  "sku": "A1"\r\n}', options: { raw: { language: 'json' } } },
            url: '{{base_url}}/pedidos'
          }
        }
      ]
    },
    {
      name: 'Upload',
      request: {
        method: 'POST',
        body: {
          mode: 'formdata',
          formdata: [
            { key: 'nome', value: 'nota', type: 'text' },
            { key: 'arquivo', src: '/Users/x/nota.pdf', type: 'file' }
          ]
        },
        url: '{{base_url}}/upload'
      }
    },
    {
      name: 'Form',
      request: {
        method: 'PUT',
        body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: '1' }] },
        url: '{{base_url}}/form'
      }
    },
    {
      name: 'GraphQL',
      request: {
        method: 'POST',
        body: { mode: 'graphql', graphql: { query: '{ me { id } }', variables: '{}' } },
        url: '{{base_url}}/graphql'
      }
    },
    {
      name: 'Estranho',
      request: { method: 'PURGE', auth: { type: 'hawk', hawk: [] }, url: '{{base_url}}/cache' }
    }
  ]
}

describe('isPostmanCollection', () => {
  it('detects Postman collections by schema', () => {
    expect(isPostmanCollection(collection)).toBe(true)
    expect(isPostmanCollection(JSON.stringify(collection))).toBe(true)
    expect(isPostmanCollection({ openapi: '3.0.0', info: {}, paths: {} })).toBe(false)
    expect(isPostmanCollection('not json')).toBe(false)
  })
})

describe('importPostmanCollection', () => {
  const result = importPostmanCollection(JSON.stringify(collection))
  const all = [
    ...result.collection.requests,
    ...result.collection.folders.flatMap((folder) => folder.requests)
  ]
  const byName = (name: string) => all.find((request) => request.name === name)!

  it('keeps the collection, root requests and flattens nested folders in order', () => {
    expect(result.schemaVersion).toBe('v2.1')
    expect(result.collection.name).toBe('Loja API')
    expect(result.collection.description).toBe('Endpoints da loja')
    expect(result.collection.requests.map((request) => request.name)).toEqual([
      'Health',
      'Upload',
      'Form',
      'GraphQL',
      'Estranho'
    ])
    expect(
      result.collection.folders.map((folder) => [folder.name, folder.requests.map((r) => r.name)])
    ).toEqual([
      ['Pedidos', ['Listar', 'Criar']],
      ['Pedidos / Detalhe', ['Por id']]
    ])
    expect(result.requestCount).toBe(8)
    expect(result.folderCount).toBe(2)
  })

  it('maps query params, disabled rows and headers', () => {
    const list = byName('Listar')
    expect(list.url).toBe('{{base_url}}/pedidos')
    expect(list.params.map((row) => [row.key, row.value, row.enabled])).toEqual([
      ['page', '1', true],
      ['size', '20', false]
    ])
    expect(list.headers.map((row) => [row.key, row.enabled])).toEqual([
      ['Accept', true],
      ['X-Debug', false]
    ])
  })

  it('inherits collection auth and honors request overrides', () => {
    expect(byName('Health').auth).toMatchObject({ type: 'bearer', token: '{{token}}' })
    expect(byName('Por id').auth.type).toBe('none')
    expect(byName('Criar').auth).toMatchObject({
      type: 'api-key',
      apiKeyName: 'X-Key',
      apiKeyValue: '{{key}}',
      apiKeyLocation: 'header'
    })
  })

  it('turns :path variables into {{variables}} and exposes them', () => {
    expect(byName('Por id').url).toBe('{{base_url}}/pedidos/{{id}}')
    expect(
      result.variables.map((variable) => [variable.key, variable.value, variable.secret ?? false])
    ).toEqual([
      ['base_url', 'https://api.loja.dev', false],
      ['token', '', true],
      ['id', '42', false],
      ['key', '', false]
    ])
  })

  it('lists variables the requests use but the collection never defines', () => {
    expect(result.warnings[0]).toContain('1 variável(is) usada(s) mas sem valor na coleção: key.')
  })

  it('converts every body mode', () => {
    expect(byName('Criar').body).toMatchObject({
      mode: 'raw',
      rawType: 'json',
      content: '{\n  "sku": "A1"\n}'
    })
    expect(byName('Upload').body.formData?.map((row) => [row.key, row.type, row.value])).toEqual([
      ['nome', 'text', 'nota'],
      ['arquivo', 'file', '']
    ])
    expect(byName('Form').body).toMatchObject({ mode: 'form-urlencoded' })
    expect(byName('Form').body.urlEncoded?.[0]).toMatchObject({ key: 'a', value: '1' })
    expect(byName('GraphQL').body).toMatchObject({ mode: 'graphql', graphql: { query: '{ me { id } }' } })
  })

  it('imports saved responses as examples', () => {
    const [example] = byName('Listar').examples
    expect(example).toMatchObject({ name: 'Sucesso' })
    expect(example?.response).toMatchObject({
      status: 200,
      statusText: 'OK',
      body: '{"items":[]}',
      contentType: 'application/json'
    })
  })

  it('warns about what it cannot carry over', () => {
    expect(result.warnings[1]).toContain('2 script(s)')
    expect(result.warnings.some((warning) => warning.includes('PURGE'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('"hawk"'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('form-data'))).toBe(true)
    expect(byName('Estranho').method).toBe('GET')
  })

  it('produces a collection the persisted workspace schema accepts', () => {
    const workspace = createWorkspace('Teste')
    workspace.collections = [result.collection]
    expect(() => workspaceSchema.parse(workspace)).not.toThrow()
  })

  it('reads v2.0 auth objects and URL strings', () => {
    const v20 = importPostmanCollection({
      info: {
        name: 'Antiga',
        schema: 'https://schema.getpostman.com/json/collection/v2.0.0/collection.json'
      },
      item: [
        {
          name: 'Login',
          request: {
            method: 'POST',
            auth: { type: 'basic', basic: { username: 'ada', password: '{{senha}}' } },
            url: 'https://api.dev/login?next=%2Fhome'
          }
        }
      ]
    })
    expect(v20.schemaVersion).toBe('v2.0')
    const [login] = v20.collection.requests
    expect(login?.auth).toMatchObject({ type: 'basic', username: 'ada', password: '{{senha}}' })
    expect(login?.url).toBe('https://api.dev/login')
    expect(login?.params[0]).toMatchObject({ key: 'next', value: '/home' })
  })

  it('explains invalid input', () => {
    expect(() => importPostmanCollection('{')).toThrow('JSON válido')
    expect(() => importPostmanCollection({ openapi: '3.0.0' })).toThrow('não é uma coleção do Postman')
    expect(() => importPostmanCollection({ info: { name: 'x' }, item: [] })).toThrow('v1')
  })
})

describe('importPostmanEnvironment', () => {
  const environment = {
    name: 'Dev',
    _postman_variable_scope: 'environment',
    values: [
      { key: 'server_dev', value: 'https://dev.api/', enabled: true, type: 'default' },
      { key: 'token', value: 'abc', enabled: true, type: 'secret' },
      { key: 'old', value: 'x', enabled: false }
    ]
  }

  it('detects and reads environment exports', () => {
    expect(isPostmanEnvironment(JSON.stringify(environment))).toBe(true)
    expect(isPostmanEnvironment(collection)).toBe(false)
    const imported = importPostmanEnvironment(environment)
    expect(imported.name).toBe('Dev')
    expect(imported.variables.map((row) => [row.key, row.value, row.enabled, row.secret ?? false])).toEqual([
      ['server_dev', 'https://dev.api/', true, false],
      ['token', 'abc', true, true],
      ['old', 'x', false, false]
    ])
  })
})
