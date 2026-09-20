export interface SidebarExpansionState {
  collections: Record<string, boolean>
  folders: Record<string, boolean>
}

export const SIDEBAR_EXPANSION_STORAGE_KEY = 'postblack:sidebar-expansion:v1'

export const EMPTY_SIDEBAR_EXPANSION: SidebarExpansionState = {
  collections: {},
  folders: {}
}

export function parseSidebarExpansion(value: string | null): SidebarExpansionState {
  if (!value) return EMPTY_SIDEBAR_EXPANSION

  try {
    const parsed = JSON.parse(value) as Partial<SidebarExpansionState>
    return {
      collections: booleanRecord(parsed.collections),
      folders: booleanRecord(parsed.folders)
    }
  } catch {
    return EMPTY_SIDEBAR_EXPANSION
  }
}

export function expansionItemKey(workspaceId: string, itemId: string): string {
  return `${workspaceId}:${itemId}`
}

export function isSidebarItemOpen(
  values: Record<string, boolean>,
  workspaceId: string,
  itemId: string
): boolean {
  return values[expansionItemKey(workspaceId, itemId)] ?? true
}

export function updateSidebarItem(
  state: SidebarExpansionState,
  type: keyof SidebarExpansionState,
  workspaceId: string,
  itemId: string,
  open: boolean
): SidebarExpansionState {
  return {
    ...state,
    [type]: {
      ...state[type],
      [expansionItemKey(workspaceId, itemId)]: open
    }
  }
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
  )
}
