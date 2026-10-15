import { z } from 'zod'
import type { ApiRequest, AppState, Workspace } from '../../shared/domain'
import { requestSchema } from '../../shared/schemas'

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

/** Unsaved editor state kept across restarts so closing the app never loses work. */
export interface RequestTabSession {
  openTabs: OpenRequestTab[]
  requestDrafts: Record<string, ApiRequest>
  scratchRequests: Record<string, ApiRequest>
  selectedRequestId: string | null
}

export const REQUEST_TAB_SESSION_KEY = 'postblack:request-tab-session'

const tabSessionSchema = z.object({
  openTabs: z.array(z.object({ workspaceId: z.string(), requestId: z.string(), pinned: z.boolean() })),
  requestDrafts: z.record(z.string(), z.unknown()),
  scratchRequests: z.record(z.string(), z.unknown()),
  selectedRequestId: z.string().nullable()
})

/**
 * Rebuilds a stored session against the current state, dropping tabs whose requests no longer
 * exist and drafts that are malformed or identical to what is already saved.
 */
export function restoreRequestTabSession(
  raw: string | null,
  state: AppState,
  findSaved: (workspace: Workspace, requestId: string) => ApiRequest | null,
  sameContent: (first: ApiRequest, second: ApiRequest) => boolean
): RequestTabSession | null {
  if (!raw) return null
  let parsed: z.infer<typeof tabSessionSchema>
  try {
    parsed = tabSessionSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }

  const workspaces = new Map(state.workspaces.map((workspace) => [workspace.id, workspace]))
  const validRequest = (value: unknown): ApiRequest | null => {
    const result = requestSchema.safeParse(value)
    return result.success ? (result.data as ApiRequest) : null
  }

  const scratchRequests: Record<string, ApiRequest> = {}
  const requestDrafts: Record<string, ApiRequest> = {}
  const openTabs: OpenRequestTab[] = []
  for (const tab of parsed.openTabs) {
    const workspace = workspaces.get(tab.workspaceId)
    if (!workspace || openTabs.some((item) => item.requestId === tab.requestId)) continue
    const scratch = validRequest(parsed.scratchRequests[tab.requestId])
    if (scratch?.id === tab.requestId) {
      scratchRequests[tab.requestId] = scratch
      openTabs.push({ ...tab, pinned: true })
      continue
    }
    const saved = findSaved(workspace, tab.requestId)
    if (!saved) continue
    const draft = validRequest(parsed.requestDrafts[tab.requestId])
    if (draft?.id === tab.requestId && !sameContent(saved, draft)) {
      requestDrafts[tab.requestId] = draft
      openTabs.push({ ...tab, pinned: true })
    } else {
      openTabs.push(tab)
    }
  }

  const selectedRequestId =
    parsed.selectedRequestId &&
    openTabs.some(
      (tab) => tab.requestId === parsed.selectedRequestId && tab.workspaceId === state.activeWorkspaceId
    )
      ? parsed.selectedRequestId
      : null
  return { openTabs, requestDrafts, scratchRequests, selectedRequestId }
}
