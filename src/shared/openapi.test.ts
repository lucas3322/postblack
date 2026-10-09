import { describe, expect, it } from 'vitest'
import { importOpenApi, isOpenApiDocument } from './openapi'
import type { ApiRequest } from './domain'

const petstore = {
  openapi: '3.0.3',
  info: { title: 'Petstore', version: '1.2.0', description: '  A sample pet store.  ' },
  servers: [{ url: 'https://petstore.example.com/v1/' }],
  tags: [{ name: 'store' }, { name: 'pets' }],
  security: [{ bearerAuth: [] }],
  paths: {
    '/pets': {
      get: {
        tags: ['pets'],
        summary: 'List pets',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 20 } },
          {
            name: 'status',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['available', 'sold'] }
          },
          { name: 'X-Request-Id', in: 'header', required: true, example: 'abc-123' },
          { name: 'Accept', in: 'header', schema: { type: 'string' } }
        ]
      },
      post: {
        tags: ['pets'],
        operationId: 'createPet',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NewPet' } } }
        }
      }
    },
    '/pets/{petId}': {
      parameters: [{ $ref: '#/components/parameters/PetId' }],
      get: { tags: ['pets'], summary: 'Get pet' },
      delete: {
        tags: ['pets'],
        parameters: [
          { name: 'petId', in: 'path', required: true, schema: { type: 'string', example: '99' } }
        ],
        security: []
      }
    },
    '/store/inventory': {
      get: { tags: ['store'], operationId: 'getInventory' }
    },
    '/health': {
      get: { summary: 'Health check' },
      trace: { summary: 'Trace' }
    }
  },
  components: {
    parameters: {
      PetId: { name: 'petId', in: 'path', required: true, schema: { type: 'integer', example: 42 } }
    },
    schemas: {
      NewPet: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'integer', readOnly: true },
          name: { type: 'string', example: 'Rex' },
          tag: { type: 'string' },
          birth: { type: 'string', format: 'date-time' },
          owner: { $ref: '#/components/schemas/Owner' },
          tags: { type: 'array', items: { type: 'string', format: 'uuid' } }
        }
      },
      Owner: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email' }, vip: { type: 'boolean' } }
      }
    },
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } }
  }
}

function allRequests(result: ReturnType<typeof importOpenApi>): ApiRequest[] {
  return [...result.collection.requests, ...result.collection.folders.flatMap((folder) => folder.requests)]
}

function findRequest(result: ReturnType<typeof importOpenApi>, name: string): ApiRequest {
  const request = allRequests(result).find((item) => item.name === name)
  if (!request) throw new Error(`Request ${name} not found`)
  return request
}

describe('OpenAPI import', () => {
  it('imports an OpenAPI 3 document with folders, params, bodies, and auth', () => {
    const result = importOpenApi(JSON.stringify(petstore))

    expect(result.format).toBe('openapi-3')
    expect(result.title).toBe('Petstore')
    expect(result.version).toBe('1.2.0')
    expect(result.operationCount).toBe(6)
    expect(result.collection.name).toBe('Petstore')
    expect(result.collection.description).toBe('A sample pet store.')
    expect(result.collection.folders.map((folder) => folder.name)).toEqual(['store', 'pets'])
    expect(result.collection.folders.every((folder) => folder.color && folder.color !== 'default')).toBe(true)
    expect(result.collection.folders[0]?.color).not.toBe(result.collection.folders[1]?.color)
    expect(result.collection.requests.map((request) => request.name)).toEqual(['Health check'])
    expect(result.warnings.some((warning) => warning.includes('TRACE'))).toBe(true)

    const variables = Object.fromEntries(result.variables.map((variable) => [variable.key, variable]))
    expect(variables.base_url?.value).toBe('https://petstore.example.com/v1')
    expect(variables.bearer_token?.secret).toBe(true)
    expect(variables.petId?.value).toBe('42')
    expect(result.variables.filter((variable) => variable.key === 'petId')).toHaveLength(1)

    const list = findRequest(result, 'List pets')
    expect(list.method).toBe('GET')
    expect(list.url).toBe('{{base_url}}/pets')
    expect(list.params.map(({ key, value, enabled }) => [key, value, enabled])).toEqual([
      ['limit', '20', false],
      ['status', 'available', true]
    ])
    expect(list.headers.map(({ key, value }) => [key, value])).toEqual([['X-Request-Id', 'abc-123']])
    expect(list.auth.type).toBe('bearer')
    expect(list.auth.token).toBe('{{bearer_token}}')

    const create = findRequest(result, 'createPet')
    expect(create.method).toBe('POST')
    expect(create.body.mode).toBe('raw')
    expect(create.body.rawType).toBe('json')
    expect(create.headers).toEqual([])
    expect(JSON.parse(create.body.content)).toEqual({
      name: 'Rex',
      tag: 'string',
      birth: '2024-01-01T00:00:00Z',
      owner: { email: 'user@example.com', vip: true },
      tags: ['3fa85f64-5717-4562-b3fc-2c963f66afa6']
    })

    const getPet = findRequest(result, 'Get pet')
    expect(getPet.url).toBe('{{base_url}}/pets/{{petId}}')

    const deletePet = findRequest(result, 'DELETE /pets/{petId}')
    expect(deletePet.auth.type).toBe('none')
    expect(findRequest(result, 'getInventory').url).toBe('{{base_url}}/store/inventory')
  })

  it('accepts already parsed objects and generates fresh ids', () => {
    const first = importOpenApi(petstore)
    const second = importOpenApi(petstore)
    expect(first.collection.id).not.toBe(second.collection.id)
    expect(allRequests(first)[0]?.id).not.toBe(allRequests(second)[0]?.id)
  })

  it('imports a Swagger 2.0 document', () => {
    const result = importOpenApi({
      swagger: '2.0',
      info: { title: 'Legacy', version: '0.9' },
      host: 'api.legacy.com',
      basePath: '/v2/',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      securityDefinitions: { key: { type: 'apiKey', name: 'X-API-Key', in: 'header' } },
      security: [{ key: [] }],
      parameters: { Page: { name: 'page', in: 'query', type: 'integer', default: 1 } },
      definitions: {
        User: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer' } } }
      },
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            parameters: [{ $ref: '#/parameters/Page' }, { name: 'X-API-Key', in: 'header', type: 'string' }]
          },
          post: {
            summary: 'Create user',
            parameters: [{ name: 'body', in: 'body', schema: { $ref: '#/definitions/User' } }]
          }
        },
        '/users/{id}/avatar': {
          post: {
            summary: 'Upload avatar',
            consumes: ['multipart/form-data'],
            parameters: [
              { name: 'id', in: 'path', required: true, type: 'string', 'x-example': 'u1' },
              { name: 'file', in: 'formData', type: 'file' },
              { name: 'caption', in: 'formData', type: 'string', default: 'hello' }
            ]
          }
        },
        '/login': {
          post: {
            summary: 'Login',
            consumes: ['application/x-www-form-urlencoded'],
            security: [],
            parameters: [
              { name: 'user', in: 'formData', type: 'string' },
              { name: 'remember', in: 'formData', type: 'boolean', default: true }
            ]
          }
        }
      }
    })

    expect(result.format).toBe('swagger-2')
    expect(result.variables.find((variable) => variable.key === 'base_url')?.value).toBe(
      'https://api.legacy.com/v2'
    )
    expect(result.variables.find((variable) => variable.key === 'api_key')?.secret).toBe(true)
    expect(result.variables.find((variable) => variable.key === 'id')?.value).toBe('u1')

    const list = findRequest(result, 'List users')
    expect(list.auth).toEqual(
      expect.objectContaining({
        type: 'api-key',
        apiKeyName: 'X-API-Key',
        apiKeyValue: '{{api_key}}',
        apiKeyLocation: 'header'
      })
    )
    expect(list.headers).toEqual([])
    expect(list.params.map(({ key, value }) => [key, value])).toEqual([['page', '1']])

    const create = findRequest(result, 'Create user')
    expect(create.body.mode).toBe('raw')
    expect(create.body.rawType).toBe('json')
    expect(JSON.parse(create.body.content)).toEqual({ name: 'string', age: 0 })

    const upload = findRequest(result, 'Upload avatar')
    expect(upload.url).toBe('{{base_url}}/users/{{id}}/avatar')
    expect(upload.body.mode).toBe('form-data')
    expect(upload.body.formData?.map(({ key, type, value }) => [key, type, value])).toEqual([
      ['file', 'file', ''],
      ['caption', 'text', 'hello']
    ])

    const login = findRequest(result, 'Login')
    expect(login.auth.type).toBe('none')
    expect(login.body.mode).toBe('form-urlencoded')
    expect(login.body.urlEncoded?.map(({ key, value }) => [key, value])).toEqual([
      ['user', ''],
      ['remember', 'true']
    ])
  })

  it('substitutes server variables and warns about relative servers', () => {
    const withVariables = importOpenApi({
      openapi: '3.1.0',
      info: { title: 'Vars', version: '1' },
      servers: [
        {
          url: '{scheme}://{region}.api.example.com:{port}/base',
          variables: {
            scheme: { default: 'https', enum: ['https', 'http'] },
            region: { default: 'eu' },
            port: { enum: ['8443'] }
          }
        }
      ],
      paths: {}
    })
    expect(withVariables.variables[0]).toEqual(
      expect.objectContaining({ key: 'base_url', value: 'https://eu.api.example.com:8443/base' })
    )

    const relative = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'Rel', version: '1' },
      servers: [{ url: '/api' }],
      paths: {}
    })
    expect(relative.variables[0]?.value).toBe('/api')
    expect(relative.warnings.some((warning) => warning.includes('relativa'))).toBe(true)

    const none = importOpenApi({ openapi: '3.0.0', info: { title: 'None', version: '1' }, paths: {} })
    expect(none.variables[0]?.value).toBe('http://localhost')
    expect(none.warnings.length).toBeGreaterThan(0)
  })

  it('keeps untagged operations at the collection root', () => {
    const result = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'Flat', version: '1' },
      servers: [{ url: 'https://flat.dev' }],
      paths: { '/a': { get: {} }, '/b': { post: { tags: [] } } }
    })
    expect(result.collection.folders).toEqual([])
    expect(result.collection.requests.map((request) => request.name)).toEqual(['GET /a', 'POST /b'])
  })

  it('does not hang on circular $refs', () => {
    const result = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'Cycle', version: '1' },
      servers: [{ url: 'https://cycle.dev' }],
      paths: {
        '/nodes': {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } }
            }
          }
        },
        '/loop': { get: { parameters: [{ $ref: '#/components/parameters/A' }] } }
      },
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              children: { type: 'array', items: { $ref: '#/components/schemas/Node' } },
              parent: { $ref: '#/components/schemas/Node' }
            }
          }
        },
        parameters: { A: { $ref: '#/components/parameters/B' }, B: { $ref: '#/components/parameters/A' } }
      }
    })
    const body = JSON.parse(findRequest(result, 'POST /nodes').body.content)
    expect(body).toEqual({ name: 'string', children: [] })
    expect(result.warnings.some((warning) => warning.includes('circular'))).toBe(true)
  })

  it('generates samples for allOf, oneOf, anyOf, and nullable types', () => {
    const result = importOpenApi({
      openapi: '3.1.0',
      info: { title: 'Compose', version: '1' },
      servers: [{ url: 'https://compose.dev' }],
      paths: {
        '/compose': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/Base' },
                      { type: 'object', properties: { extra: { type: 'number' } } }
                    ],
                    properties: { own: { type: 'string', const: 'fixed' } }
                  }
                }
              }
            }
          }
        },
        '/choice': {
          put: {
            requestBody: {
              content: {
                'application/vnd.api+json': {
                  schema: {
                    type: 'object',
                    properties: {
                      pet: { oneOf: [{ $ref: '#/components/schemas/Base' }, { type: 'string' }] },
                      id: { anyOf: [{ type: 'integer' }, { type: 'string' }] },
                      note: { type: ['string', 'null'] }
                    }
                  }
                }
              }
            }
          }
        }
      },
      components: {
        schemas: { Base: { type: 'object', properties: { kind: { type: 'string', enum: ['cat', 'dog'] } } } }
      }
    })

    expect(JSON.parse(findRequest(result, 'POST /compose').body.content)).toEqual({
      kind: 'cat',
      extra: 0,
      own: 'fixed'
    })
    const choice = findRequest(result, 'PUT /choice')
    expect(JSON.parse(choice.body.content)).toEqual({ pet: { kind: 'cat' }, id: 0, note: 'string' })
    expect(choice.headers.map(({ key, value }) => [key, value])).toEqual([
      ['Content-Type', 'application/vnd.api+json']
    ])
  })

  it('prefers explicit examples and maps multipart, urlencoded, and auth variants', () => {
    const result = importOpenApi({
      openapi: '3.0.0',
      info: { title: 'Variants', version: '1' },
      servers: [{ url: 'https://variants.dev' }],
      paths: {
        '/example': {
          post: {
            security: [{ basic: [] }],
            requestBody: {
              content: {
                'application/json': {
                  examples: { first: { value: { hello: 'world' } }, second: { value: { other: true } } }
                },
                'application/xml': {}
              }
            }
          }
        },
        '/upload': {
          post: {
            security: [{ oauth: ['read'] }],
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Doc title' },
                      file: { type: 'string', format: 'binary' }
                    }
                  }
                }
              }
            }
          }
        },
        '/form': {
          post: {
            security: [{ queryKey: [] }],
            parameters: [{ name: 'session', in: 'cookie', schema: { type: 'string', example: 'abc' } }],
            requestBody: {
              content: {
                'application/x-www-form-urlencoded': {
                  schema: { type: 'object', properties: { q: { type: 'string', default: 'term' } } }
                }
              }
            }
          }
        },
        '/text': {
          post: {
            security: [{ cookieKey: [] }],
            requestBody: { content: { 'text/plain': { example: 'hi' } } }
          }
        }
      },
      components: {
        securitySchemes: {
          basic: { type: 'http', scheme: 'basic' },
          oauth: { type: 'oauth2', flows: {} },
          queryKey: { type: 'apiKey', in: 'query', name: 'key' },
          cookieKey: { type: 'apiKey', in: 'cookie', name: 'sid' }
        }
      }
    })

    const example = findRequest(result, 'POST /example')
    expect(JSON.parse(example.body.content)).toEqual({ hello: 'world' })
    expect(example.auth).toEqual(
      expect.objectContaining({ type: 'basic', username: '{{username}}', password: '{{password}}' })
    )

    const upload = findRequest(result, 'POST /upload')
    expect(upload.auth).toEqual(expect.objectContaining({ type: 'bearer', token: '{{access_token}}' }))
    expect(upload.body.mode).toBe('form-data')
    expect(upload.body.formData?.map(({ key, type, description }) => [key, type, description])).toEqual([
      ['title', 'text', 'Doc title'],
      ['file', 'file', '']
    ])

    const form = findRequest(result, 'POST /form')
    expect(form.auth).toEqual(
      expect.objectContaining({ type: 'api-key', apiKeyName: 'key', apiKeyLocation: 'query' })
    )
    expect(form.body.mode).toBe('form-urlencoded')
    expect(form.body.urlEncoded?.map(({ key, value }) => [key, value])).toEqual([['q', 'term']])
    expect(form.headers.map(({ key, value, enabled }) => [key, value, enabled])).toEqual([
      ['Cookie', 'session=abc', false]
    ])

    const text = findRequest(result, 'POST /text')
    expect(text.body).toEqual(expect.objectContaining({ mode: 'raw', rawType: 'text', content: 'hi' }))
    expect(text.headers.map(({ key, value }) => [key, value])).toEqual([['Cookie', 'sid={{api_key}}']])

    const keys = result.variables.map((variable) => variable.key)
    expect(keys).toEqual(expect.arrayContaining(['username', 'password', 'access_token', 'api_key']))
    expect(result.variables.find((variable) => variable.key === 'username')?.secret).toBeUndefined()
    expect(result.warnings.some((warning) => warning.includes('OAuth'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('cookie'))).toBe(true)
  })

  it('truncates documents with too many operations', () => {
    const paths = Object.fromEntries(Array.from({ length: 2100 }, (_, index) => [`/r${index}`, { get: {} }]))
    const result = importOpenApi({ openapi: '3.0.0', info: { title: 'Big', version: '1' }, paths })
    expect(result.operationCount).toBe(2000)
    expect(result.collection.requests).toHaveLength(2000)
    expect(result.warnings.some((warning) => warning.includes('2000'))).toBe(true)
  })

  it('rejects invalid input with clear messages', () => {
    expect(() => importOpenApi('')).toThrow('vazio')
    expect(() => importOpenApi('{not json')).toThrow('JSON válido')
    expect(() => importOpenApi('openapi: 3.0.0\ninfo:\n  title: Yaml\n')).toThrow('YAML')
    expect(() => importOpenApi('[]')).toThrow('objeto JSON')
    expect(() => importOpenApi({ info: {} })).toThrow('openapi')
    expect(() => importOpenApi({ swagger: '1.2' })).toThrow('Swagger')
    expect(() => importOpenApi({ openapi: '4.0.0' })).toThrow('OpenAPI')
  })

  it('tolerates odd but valid documents without throwing', () => {
    const result = importOpenApi({
      openapi: '3.1.0',
      info: { title: 'Odd', version: '1' },
      paths: {
        '/x': {
          get: { parameters: [{ $ref: '#/components/parameters/Missing' }, null] },
          summary: 'ignored'
        },
        '/y': null
      }
    })
    expect(result.operationCount).toBe(1)
    expect(result.warnings.some((warning) => warning.includes('Missing'))).toBe(true)
  })
})

describe('isOpenApiDocument', () => {
  it('detects OpenAPI and Swagger documents', () => {
    expect(isOpenApiDocument(petstore)).toBe(true)
    expect(isOpenApiDocument(JSON.stringify(petstore))).toBe(true)
    expect(isOpenApiDocument({ swagger: '2.0', paths: {} })).toBe(true)
    expect(isOpenApiDocument({ openapi: '3.1.0', webhooks: {} })).toBe(true)
    expect(isOpenApiDocument({ openapi: '3.0.0' })).toBe(false)
    expect(isOpenApiDocument({ swagger: '1.2', paths: {} })).toBe(false)
    expect(isOpenApiDocument({ info: {}, item: [] })).toBe(false)
    expect(isOpenApiDocument('not json')).toBe(false)
    expect(isOpenApiDocument(null)).toBe(false)
  })
})

describe('importOpenApi persistence', () => {
  it('produces collections that pass the persisted workspace schema', async () => {
    const { workspaceSchema } = await import('./schemas')
    const { createWorkspace } = await import('./domain')
    const imported = importOpenApi({
      openapi: '3.0.3',
      info: { title: 'Shop', version: '1.0.0' },
      servers: [{ url: 'https://api.shop.dev' }],
      tags: [{ name: 'orders' }],
      paths: {
        '/orders/{id}': {
          get: { tags: ['orders'], parameters: [{ name: 'id', in: 'path', required: true }] },
          put: {
            tags: ['orders'],
            requestBody: {
              content: {
                'application/json': { schema: { type: 'object', properties: { a: { type: 'string' } } } }
              }
            }
          }
        },
        '/upload': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } }
                }
              }
            }
          }
        }
      }
    })
    const workspace = createWorkspace('Test')
    workspace.collections = [imported.collection]
    expect(() => workspaceSchema.parse(workspace)).not.toThrow()
  })
})
