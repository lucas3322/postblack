import { Plus, X } from 'lucide-react'
import type { ApiRequest } from '../../../shared/domain'
import type { OpenRequestTab } from '../request-tabs'

interface RequestTabBarProps {
  tabs: OpenRequestTab[]
  requests: Record<string, ApiRequest>
  selectedRequestId: string | null
  dirtyRequestIds: ReadonlySet<string>
  onSelect: (requestId: string) => void
  onPin: (requestId: string) => void
  onClose: (requestId: string) => void
  onNew: () => void
}

export function RequestTabBar({
  tabs,
  requests,
  selectedRequestId,
  dirtyRequestIds,
  onSelect,
  onPin,
  onClose,
  onNew
}: RequestTabBarProps): React.JSX.Element {
  return (
    <nav className="request-tab-bar" aria-label="Open requests">
      {tabs.map((tab) => {
        const request = requests[tab.requestId]
        if (!request) return null

        const dirty = dirtyRequestIds.has(tab.requestId)
        return (
          <div
            key={tab.requestId}
            className={`request-open-tab${tab.requestId === selectedRequestId ? ' active' : ''}${
              tab.pinned ? ' pinned' : ' preview'
            }`}
          >
            <button
              className="request-open-tab-select"
              onClick={() => onSelect(tab.requestId)}
              onDoubleClick={() => onPin(tab.requestId)}
              title={tab.pinned ? request.name : `${request.name} — double-click to keep open`}
            >
              <span className={`method-label method-${request.method.toLowerCase()}`}>{request.method}</span>
              <span className="request-open-tab-name">{request.name}</span>
            </button>
            <button
              className={`request-tab-close${dirty ? ' dirty' : ''}`}
              onClick={() => onClose(tab.requestId)}
              aria-label={`Close ${request.name}${dirty ? ' (unsaved changes)' : ''}`}
              title={dirty ? 'Unsaved changes — click to close' : 'Close tab'}
            >
              {dirty ? <span className="request-tab-dirty-dot" /> : <X size={13} />}
            </button>
          </div>
        )
      })}
      <button
        type="button"
        className="request-new-tab"
        onClick={onNew}
        aria-label="New request"
        title="New request (Ctrl/⌘+N)"
      >
        <Plus size={15} />
      </button>
    </nav>
  )
}
