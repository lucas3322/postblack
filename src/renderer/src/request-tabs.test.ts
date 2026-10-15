import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  createRequest,
  type ApiRequest,
  type AppState,
  type Workspace
} from '../../shared/domain'
import { closeRequestTab, openRequestTab, restoreRequestTabSession } from './request-tabs'

describe('request tabs', () => {
  it('replaces a clean preview tab on single click', () => {
    const first = openRequestTab([], 'workspace', 'one', false, new Set())
    expect(openRequestTab(first, 'workspace', 'two', false, new Set())).toEqual([
      { workspaceId: 'workspace', requestId: 'two', pinned: false }
    ])
  })

  it('retains pinned and unsaved tabs when opening a new preview', () => {
    const first = openRequestTab([], 'workspace', 'one', true, new Set())
    const second = openRequestTab(first, 'workspace', 'two', false, new Set())
    const third = openRequestTab(second, 'workspace', 'three', false, new Set(['two']))
    expect(third.map((tab) => tab.requestId)).toEqual(['one', 'two', 'three'])
    expect(third[0]?.pinned).toBe(true)
    expect(third[1]?.pinned).toBe(true)
  })

  it('pins an existing preview and closes only the chosen tab', () => {
    const preview = openRequestTab([], 'workspace', 'one', false, new Set())
    const pinned = openRequestTab(preview, 'workspace', 'one', true, new Set())
    expect(pinned[0]?.pinned).toBe(true)
    expect(closeRequestTab(pinned, 'workspace', 'one')).toEqual([])
  })
})

describe('request tab session', () => {
  const findSaved = (workspace: Workspace, requestId: string): ApiRequest | null =>
    workspace.collections
      .flatMap((collection) => [
        ...collection.requests,
        ...collection.folders.flatMap((folder) => folder.requests)
      ])
      .find((request) => request.id === requestId) ?? null
  const same = (first: ApiRequest, second: ApiRequest): boolean =>
    JSON.stringify(first) === JSON.stringify(second)

  const setup = (): { state: AppState; saved: ApiRequest; workspaceId: string } => {
    const state = createInitialState()
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId)!
    const saved = createRequest('Saved')
    workspace.collections[0]!.requests.push(saved)
    return { state, saved, workspaceId: workspace.id }
  }

  it('restores unsaved drafts and new requests as pinned tabs', () => {
    const { state, saved, workspaceId } = setup()
    const draft = { ...saved, url: 'https://changed.example.com' }
    const scratch = createRequest('Untitled')
    const raw = JSON.stringify({
      openTabs: [
        { workspaceId, requestId: saved.id, pinned: false },
        { workspaceId, requestId: scratch.id, pinned: true }
      ],
      requestDrafts: { [saved.id]: draft },
      scratchRequests: { [scratch.id]: scratch },
      selectedRequestId: scratch.id
    })
    const session = restoreRequestTabSession(raw, state, findSaved, same)
    expect(session?.openTabs).toEqual([
      { workspaceId, requestId: saved.id, pinned: true },
      { workspaceId, requestId: scratch.id, pinned: true }
    ])
    expect(session?.requestDrafts[saved.id]?.url).toBe('https://changed.example.com')
    expect(session?.scratchRequests[scratch.id]?.name).toBe('Untitled')
    expect(session?.selectedRequestId).toBe(scratch.id)
  })

  it('drops tabs for deleted requests or workspaces and drafts matching the saved copy', () => {
    const { state, saved, workspaceId } = setup()
    const raw = JSON.stringify({
      openTabs: [
        { workspaceId, requestId: saved.id, pinned: false },
        { workspaceId, requestId: 'request_gone', pinned: true },
        { workspaceId: 'workspace_gone', requestId: saved.id, pinned: true }
      ],
      requestDrafts: { [saved.id]: saved },
      scratchRequests: {},
      selectedRequestId: 'request_gone'
    })
    const session = restoreRequestTabSession(raw, state, findSaved, same)
    expect(session?.openTabs).toEqual([{ workspaceId, requestId: saved.id, pinned: false }])
    expect(session?.requestDrafts).toEqual({})
    expect(session?.selectedRequestId).toBeNull()
  })

  it('ignores missing or corrupted sessions', () => {
    const { state } = setup()
    expect(restoreRequestTabSession(null, state, findSaved, same)).toBeNull()
    expect(restoreRequestTabSession('{not json', state, findSaved, same)).toBeNull()
    expect(restoreRequestTabSession('{"openTabs": 3}', state, findSaved, same)).toBeNull()
  })
})
