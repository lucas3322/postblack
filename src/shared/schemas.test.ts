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
})
