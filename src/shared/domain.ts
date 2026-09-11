export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]
export type BodyMode = 'none' | 'json' | 'text' | 'form-urlencoded'
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key'

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

export interface RequestAuth {
  type: AuthType
  token: string
  username: string
  password: string
  apiKeyName: string
  apiKeyValue: string
  apiKeyLocation: 'header' | 'query'
}

export interface RequestBody {
  mode: BodyMode
  content: string
}

export interface ApiRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: RequestBody
  auth: RequestAuth
  createdAt: string
  updatedAt: string
}

export interface RequestCollection {
  id: string
  name: string
  requests: ApiRequest[]
  createdAt: string
}

export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
}

export interface Workspace {
  id: string
  name: string
  description: string
  collections: RequestCollection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  variables: KeyValue[]
  createdAt: string
  updatedAt: string
}

export interface ResponseSnapshot {
  id: string
  requestId: string
  requestName: string
  method: HttpMethod
  url: string
  status: number
  statusText: string
  durationMs: number
  sizeBytes: number
  headers: KeyValue[]
  body: string
  contentType: string
  error?: string
  createdAt: string
}

export interface AppState {
  schemaVersion: 1
  globalVariables: KeyValue[]
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  history: ResponseSnapshot[]
}

export interface ExecuteRequestInput {
  request: ApiRequest
  variables: Record<string, string>
}

export interface ImportedCurl {
  request: ApiRequest
  warnings: string[]
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  architecture: string
}

export interface UpdateInfo {
  status: 'current' | 'available' | 'missing-asset' | 'error'
  currentVersion: string
  latestVersion?: string
  notes?: string
  publishedAt?: string
  downloadUrl?: string
  fileName?: string
  sizeBytes?: number
  releasePageUrl?: string
  message?: string
}

export interface UpdateProgress {
  receivedBytes: number
  totalBytes: number
}

export interface PostblackApi {
  loadState: () => Promise<AppState>
  saveState: (state: AppState) => Promise<void>
  executeRequest: (input: ExecuteRequestInput) => Promise<ResponseSnapshot>
  importCurl: (command: string) => Promise<ImportedCurl>
  generateCurl: (input: ExecuteRequestInput) => Promise<string>
  app: {
    info: () => Promise<AppInfo>
  }
  updates: {
    check: () => Promise<UpdateInfo>
    download: () => Promise<{ path: string }>
    openReleasePage: () => Promise<void>
    onProgress: (listener: (progress: UpdateProgress) => void) => () => void
  }
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function createKeyValue(key = '', value = ''): KeyValue {
  return { id: createId('field'), key, value, enabled: true }
}

export function createRequest(name = 'New request'): ApiRequest {
  const timestamp = nowIso()
  return {
    id: createId('request'),
    name,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: { mode: 'none', content: '' },
    auth: {
      type: 'none',
      token: '',
      username: '',
      password: '',
      apiKeyName: '',
      apiKeyValue: '',
      apiKeyLocation: 'header'
    },
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function createWorkspace(name = 'My workspace'): Workspace {
  const timestamp = nowIso()
  const request = createRequest('Example request')
  request.url = '{{base_url}}/get'
  return {
    id: createId('workspace'),
    name,
    description: 'Your local API workspace',
    collections: [
      { id: createId('collection'), name: 'Getting started', requests: [request], createdAt: timestamp }
    ],
    environments: [
      {
        id: createId('environment'),
        name: 'Development',
        variables: [createKeyValue('base_url', 'https://postman-echo.com')]
      }
    ],
    activeEnvironmentId: null,
    variables: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function createInitialState(): AppState {
  const workspace = createWorkspace()
  workspace.activeEnvironmentId = workspace.environments[0]?.id ?? null
  return {
    schemaVersion: 1,
    globalVariables: [],
    workspaces: [workspace],
    activeWorkspaceId: workspace.id,
    history: []
  }
}
