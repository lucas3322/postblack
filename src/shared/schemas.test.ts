import { describe, expect, it } from 'vitest'
import { createInitialState } from './domain'
import { appStateSchema } from './schemas'

describe('state migrations', () => {
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
})
