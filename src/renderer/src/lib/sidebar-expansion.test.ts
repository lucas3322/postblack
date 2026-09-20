import { describe, expect, it } from 'vitest'
import {
  EMPTY_SIDEBAR_EXPANSION,
  expansionItemKey,
  isSidebarItemOpen,
  parseSidebarExpansion,
  updateSidebarItem
} from './sidebar-expansion'

describe('sidebar expansion persistence', () => {
  it('keeps new collections and folders open by default', () => {
    expect(isSidebarItemOpen({}, 'workspace-1', 'collection-1')).toBe(true)
  })

  it('stores expansion independently for each workspace', () => {
    const collapsed = updateSidebarItem(
      EMPTY_SIDEBAR_EXPANSION,
      'collections',
      'workspace-1',
      'collection-1',
      false
    )

    expect(isSidebarItemOpen(collapsed.collections, 'workspace-1', 'collection-1')).toBe(false)
    expect(isSidebarItemOpen(collapsed.collections, 'workspace-2', 'collection-1')).toBe(true)
  })

  it('recovers valid values and ignores corrupted storage', () => {
    const key = expansionItemKey('workspace-1', 'folder-1')
    expect(parseSidebarExpansion(JSON.stringify({ collections: {}, folders: { [key]: false } }))).toEqual({
      collections: {},
      folders: { [key]: false }
    })
    expect(parseSidebarExpansion('{broken')).toEqual(EMPTY_SIDEBAR_EXPANSION)
  })
})
