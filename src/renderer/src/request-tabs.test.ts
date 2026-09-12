import { describe, expect, it } from 'vitest'
import { closeRequestTab, openRequestTab } from './request-tabs'

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
