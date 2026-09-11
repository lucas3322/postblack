import { ChevronDown, ChevronRight, FolderClosed, History, MoreHorizontal, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ApiRequest, RequestCollection, Workspace } from '../../../shared/domain'

interface SidebarProps {
  workspace: Workspace
  selectedRequestId: string | null
  onSelectRequest: (request: ApiRequest) => void
  onAddCollection: () => void
  onAddRequest: (collectionId: string) => void
  onShowHistory: () => void
}

export function Sidebar({
  workspace,
  selectedRequestId,
  onSelectRequest,
  onAddCollection,
  onAddRequest,
  onShowHistory
}: SidebarProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const collections = useMemo(
    () => filterCollections(workspace.collections, query),
    [workspace.collections, query]
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search requests"
        />
      </div>
      <button className="history-button" onClick={onShowHistory}>
        <History size={16} /> History
      </button>
      <div className="section-heading">
        <span>Collections</span>
        <button className="icon-button" onClick={onAddCollection} title="New collection">
          <Plus size={16} />
        </button>
      </div>
      <div className="collection-list">
        {collections.map((collection) => (
          <CollectionNode
            key={collection.id}
            collection={collection}
            selectedRequestId={selectedRequestId}
            onSelectRequest={onSelectRequest}
            onAddRequest={onAddRequest}
          />
        ))}
        {collections.length === 0 && <div className="empty-inline">No matching requests.</div>}
      </div>
    </aside>
  )
}

function CollectionNode({
  collection,
  selectedRequestId,
  onSelectRequest,
  onAddRequest
}: {
  collection: RequestCollection
  selectedRequestId: string | null
  onSelectRequest: (request: ApiRequest) => void
  onAddRequest: (collectionId: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="collection-node">
      <div className="collection-row">
        <button className="tree-toggle" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderClosed size={15} />
          <span>{collection.name}</span>
        </button>
        <button className="icon-button" title="Add request" onClick={() => onAddRequest(collection.id)}>
          <Plus size={14} />
        </button>
        <button className="icon-button ghost">
          <MoreHorizontal size={14} />
        </button>
      </div>
      {open && (
        <div className="request-list">
          {collection.requests.map((request) => (
            <button
              key={request.id}
              className={request.id === selectedRequestId ? 'request-row selected' : 'request-row'}
              onClick={() => onSelectRequest(request)}
            >
              <span className={`method-label method-${request.method.toLowerCase()}`}>{request.method}</span>
              <span>{request.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function filterCollections(collections: RequestCollection[], query: string): RequestCollection[] {
  if (!query.trim()) return collections
  const normalized = query.toLowerCase()
  return collections
    .map((collection) => ({
      ...collection,
      requests: collection.requests.filter(
        (request) =>
          request.name.toLowerCase().includes(normalized) || request.url.toLowerCase().includes(normalized)
      )
    }))
    .filter(
      (collection) => collection.name.toLowerCase().includes(normalized) || collection.requests.length > 0
    )
}
