import { describe, expect, it } from 'vitest'
import { createInitialState } from './domain'
import { appStateSchema, requestSchema } from './schemas'

describe('state migrations', () => {
  it('round-trips scripts and results while accepting requests from before scripts existed', () => {
    const state = createInitialState()
    const request = state.workspaces[0]!.collections[0]!.requests[0]!
    expect(requestSchema.parse(request).scripts).toBeUndefined()
    request.scripts = {
      preRequest: 'pm.variables.set("id", "42")',
      postResponse: 'console.log(pm.response.code)'
    }
    expect(
      appStateSchema.parse(JSON.parse(JSON.stringify(state))).workspaces[0]?.collections[0]?.requests[0]
        ?.scripts
    ).toEqual(request.scripts)
  })
  it('adds global variables when loading state created before global scope existed', () => {
    const currentState = createInitialState()
    const { globalVariables: _missingInLegacyState, ...legacyState } = currentState

    const migratedState = appStateSchema.parse(legacyState)

    expect(migratedState.globalVariables).toEqual([])
    expect(migratedState.workspaces).toHaveLength(1)
  })

  it('adds an empty example list to requests created before examples existed', () => {
    const currentState = createInitialState()
    const request = currentState.workspaces[0]?.collections[0]?.requests[0]
    expect(request).toBeDefined()

    const { examples: _missingInLegacyRequest, ...legacyRequest } = request!
    currentState.workspaces[0]!.collections[0]!.requests = [legacyRequest as typeof request]

    const migratedState = appStateSchema.parse(currentState)

    expect(migratedState.workspaces[0]?.collections[0]?.requests[0]?.examples).toEqual([])
  })

  it('adds an empty description to collections created before collection overviews existed', () => {
    const currentState = createInitialState()
    const collection = currentState.workspaces[0]?.collections[0]
    expect(collection).toBeDefined()

    const { description: _missingInLegacyCollection, ...legacyCollection } = collection!
    currentState.workspaces[0]!.collections = [legacyCollection as typeof collection]

    const migratedState = appStateSchema.parse(currentState)

    expect(migratedState.workspaces[0]?.collections[0]?.description).toBe('')
  })

  it('adds an empty folder list to collections created before folders existed', () => {
    const currentState = createInitialState()
    const collection = currentState.workspaces[0]?.collections[0]
    expect(collection).toBeDefined()

    const { folders: _missingInLegacyCollection, ...legacyCollection } = collection!
    currentState.workspaces[0]!.collections = [legacyCollection as typeof collection]

    const migratedState = appStateSchema.parse(currentState)

    expect(migratedState.workspaces[0]?.collections[0]?.folders).toEqual([])
  })

  it('adds the default color to folders created before folder colors existed', () => {
    const currentState = createInitialState()
    currentState.workspaces[0]!.collections[0]!.folders = [
      { id: 'legacy-folder', name: 'Legacy', requests: [], createdAt: 'now' }
    ]

    const migratedState = appStateSchema.parse(currentState)

    expect(migratedState.workspaces[0]?.collections[0]?.folders[0]?.color).toBe('default')
  })

  it('adds the extended body fields to requests created before file and GraphQL support', () => {
    const currentState = createInitialState()
    const request = currentState.workspaces[0]!.collections[0]!.requests[0]!
    request.body = { mode: 'json', content: '{"legacy":true}' }

    const migratedState = appStateSchema.parse(currentState)
    const body = migratedState.workspaces[0]!.collections[0]!.requests[0]!.body

    expect(body.rawType).toBe('json')
    expect(body.formData).toEqual([])
    expect(body.urlEncoded).toEqual([])
    expect(body.binaryFile).toBeNull()
    expect(body.graphql).toEqual({ query: '', variables: '' })
  })
})
