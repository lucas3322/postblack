export interface OpenRequestTab {
  workspaceId: string
  requestId: string
  pinned: boolean
}

export function openRequestTab(
  tabs: OpenRequestTab[],
  workspaceId: string,
  requestId: string,
  pinned: boolean,
  dirtyRequestIds: ReadonlySet<string>
): OpenRequestTab[] {
  const existing = tabs.find((tab) => tab.workspaceId === workspaceId && tab.requestId === requestId)
  if (existing) {
    return pinned ? tabs.map((tab) => (tab === existing ? { ...tab, pinned: true } : tab)) : tabs
  }

  const retained = tabs
    .filter((tab) => tab.workspaceId !== workspaceId || tab.pinned || dirtyRequestIds.has(tab.requestId))
    .map((tab) =>
      tab.workspaceId === workspaceId && dirtyRequestIds.has(tab.requestId) ? { ...tab, pinned: true } : tab
    )
  return [...retained, { workspaceId, requestId, pinned }]
}

export function closeRequestTab(
  tabs: OpenRequestTab[],
  workspaceId: string,
  requestId: string
): OpenRequestTab[] {
  return tabs.filter((tab) => tab.workspaceId !== workspaceId || tab.requestId !== requestId)
}
