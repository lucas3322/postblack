import { z } from 'zod'
import { FOLDER_COLORS } from './domain'

const keyValueSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  secret: z.boolean().optional()
})

const nativeFileReferenceSchema = z.object({
  path: z.string(),
  name: z.string(),
  size: z.number().nonnegative(),
  mimeType: z.string()
})

const formDataEntrySchema = keyValueSchema.extend({
  type: z.enum(['text', 'file']),
  description: z.string().default(''),
  file: nativeFileReferenceSchema.nullable().default(null)
})

const authSchema = z.object({
  type: z.enum(['none', 'bearer', 'basic', 'api-key']),
  token: z.string(),
  username: z.string(),
  password: z.string(),
  apiKeyName: z.string(),
  apiKeyValue: z.string(),
  apiKeyLocation: z.enum(['header', 'query'])
})

const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

const responseSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  requestName: z.string(),
  method: httpMethodSchema,
  url: z.string(),
  status: z.number(),
  statusText: z.string(),
  durationMs: z.number(),
  sizeBytes: z.number(),
  headers: z.array(keyValueSchema),
  body: z.string(),
  contentType: z.string(),
  error: z.string().optional(),
  createdAt: z.string()
})

const requestExampleSchema = z.object({
  id: z.string(),
  name: z.string(),
  response: responseSchema,
  createdAt: z.string()
})

export const requestSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: httpMethodSchema,
  url: z.string(),
  params: z.array(keyValueSchema),
  headers: z.array(keyValueSchema),
  body: z.object({
    mode: z.enum(['none', 'form-data', 'form-urlencoded', 'raw', 'binary', 'graphql', 'json', 'text']),
    content: z.string(),
    rawType: z.enum(['json', 'text', 'javascript', 'html', 'xml']).default('json'),
    formData: z.array(formDataEntrySchema).default([]),
    urlEncoded: z.array(keyValueSchema).default([]),
    binaryFile: nativeFileReferenceSchema.nullable().default(null),
    graphql: z.object({ query: z.string(), variables: z.string() }).default({ query: '', variables: '' })
  }),
  auth: authSchema,
  examples: z.array(requestExampleSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string()
})

const requestFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  requests: z.array(requestSchema),
  createdAt: z.string(),
  color: z.enum(FOLDER_COLORS).default('default')
})

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  collections: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().default(''),
      requests: z.array(requestSchema),
      folders: z.array(requestFolderSchema).default([]),
      createdAt: z.string(),
      color: z.enum(FOLDER_COLORS).default('default')
    })
  ),
  environments: z.array(z.object({ id: z.string(), name: z.string(), variables: z.array(keyValueSchema) })),
  activeEnvironmentId: z.string().nullable(),
  variables: z.array(keyValueSchema),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const appStateSchema = z.object({
  schemaVersion: z.literal(1),
  globalVariables: z.array(keyValueSchema).default([]),
  workspaces: z.array(workspaceSchema),
  activeWorkspaceId: z.string().nullable(),
  history: z.array(responseSchema)
})

export const executeRequestSchema = z.object({
  request: requestSchema,
  variables: z.record(z.string(), z.string())
})
