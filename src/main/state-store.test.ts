import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../shared/domain'
import { JsonStateStore } from './state-store'

const mockPaths = vi.hoisted(() => ({ userData: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => mockPaths.userData }
}))

describe('JsonStateStore', () => {
  beforeEach(async () => {
    mockPaths.userData = await mkdtemp(join(tmpdir(), 'postblack-state-test-'))
  })

  afterEach(async () => {
    await rm(mockPaths.userData, { recursive: true, force: true })
  })

  it('keeps the newest state when saves overlap', async () => {
    const store = new JsonStateStore()
    const first = createInitialState()
    const second = createInitialState()
    first.workspaces[0]!.name = 'First name'
    second.workspaces[0]!.name = 'Latest name'

    await Promise.all([store.save(first), store.save(second)])

    expect((await store.load()).workspaces[0]?.name).toBe('Latest name')
  })

  it('waits for a pending save before loading', async () => {
    const store = new JsonStateStore()
    const state = createInitialState()
    state.workspaces[0]!.name = 'Saved workspace'

    const save = store.save(state)
    const loaded = store.load()

    await save
    expect((await loaded).workspaces[0]?.name).toBe('Saved workspace')
  })
})
