import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Files,
  FolderClosed,
  History,
  Link,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ApiRequest, RequestCollection, RequestExample, Workspace } from '../../../shared/domain'

interface SidebarProps {
  workspace: Workspace
  selectedRequestId: string | null
  onSelectRequest: (request: ApiRequest) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onAddCollection: () => void
  onRenameCollection: (collection: RequestCollection) => void
  onAddRequest: (collectionId: string) => void
  onAddExample: (request: ApiRequest) => void
  onShareRequest: (request: ApiRequest) => void
  onCopyLink: (request: ApiRequest) => void
  onRenameRequest: (request: ApiRequest) => void
  onCopyRequest: (request: ApiRequest) => void
  onDuplicateRequest: (request: ApiRequest) => void
  onDeleteRequest: (request: ApiRequest) => void
  onShowHistory: () => void
}

interface RequestMenuState {
  request: ApiRequest
  x: number
  y: number
}

export function Sidebar({
  workspace,
  selectedRequestId,
  onSelectRequest,
  onSelectExample,
  onAddCollection,
  onRenameCollection,
  onAddRequest,
  onAddExample,
  onShareRequest,
  onCopyLink,
  onRenameRequest,
  onCopyRequest,
  onDuplicateRequest,
  onDeleteRequest,
  onShowHistory
}: SidebarProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [requestMenu, setRequestMenu] = useState<RequestMenuState | null>(null)
  const firstMenuItem = useRef<HTMLButtonElement>(null)
  const collections = useMemo(
    () => filterCollections(workspace.collections, query),
    [workspace.collections, query]
  )

  useEffect(() => {
    if (!requestMenu) return

    firstMenuItem.current?.focus()
    const close = (): void => setRequestMenu(null)
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }

    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [requestMenu])

  const openRequestMenu = (request: ApiRequest, x: number, y: number): void => {
    onSelectRequest(request)
    setRequestMenu({ request, ...menuPosition(x, y) })
  }

  const runMenuAction = (action: (request: ApiRequest) => void): void => {
    if (!requestMenu) return
    const request = requestMenu.request
    setRequestMenu(null)
    action(request)
  }

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
            openRequestMenuId={requestMenu?.request.id ?? null}
            onSelectRequest={onSelectRequest}
            onSelectExample={onSelectExample}
            onAddRequest={onAddRequest}
            onRenameCollection={onRenameCollection}
            onOpenRequestMenu={openRequestMenu}
          />
        ))}
        {collections.length === 0 && <div className="empty-inline">No matching requests.</div>}
      </div>

      {requestMenu &&
        createPortal(
          <div
            className="request-context-menu"
            role="menu"
            aria-label={`Actions for ${requestMenu.request.name}`}
            style={{ left: requestMenu.x, top: requestMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <MenuButton
              ref={firstMenuItem}
              icon={<Plus size={15} />}
              label="Add example"
              onClick={() => runMenuAction(onAddExample)}
            />
            <div className="request-menu-separator" />
            <MenuButton
              icon={<Share2 size={15} />}
              label="Share"
              onClick={() => runMenuAction(onShareRequest)}
            />
            <MenuButton
              icon={<Link size={15} />}
              label="Copy link"
              onClick={() => runMenuAction(onCopyLink)}
            />
            <div className="request-menu-separator" />
            <MenuButton
              icon={<Pencil size={15} />}
              label="Rename"
              shortcut="⌘E"
              onClick={() => runMenuAction(onRenameRequest)}
            />
            <MenuButton
              icon={<Copy size={15} />}
              label="Copy"
              shortcut="⌘C"
              onClick={() => runMenuAction(onCopyRequest)}
            />
            <MenuButton
              icon={<Files size={15} />}
              label="Duplicate"
              shortcut="⌘D"
              onClick={() => runMenuAction(onDuplicateRequest)}
            />
            <MenuButton
              danger
              icon={<Trash2 size={15} />}
              label="Delete"
              shortcut="⌫"
              onClick={() => runMenuAction(onDeleteRequest)}
            />
          </div>,
          document.body
        )}
    </aside>
  )
}

function CollectionNode({
  collection,
  selectedRequestId,
  openRequestMenuId,
  onSelectRequest,
  onSelectExample,
  onAddRequest,
  onRenameCollection,
  onOpenRequestMenu
}: {
  collection: RequestCollection
  selectedRequestId: string | null
  openRequestMenuId: string | null
  onSelectRequest: (request: ApiRequest) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onAddRequest: (collectionId: string) => void
  onRenameCollection: (collection: RequestCollection) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="collection-node">
      <div
        className="collection-row"
        onDoubleClick={() => onRenameCollection(collection)}
        title="Double-click to rename collection"
      >
        <button className="tree-toggle" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderClosed size={15} />
          <span>{collection.name}</span>
        </button>
        <button className="icon-button" title="Add request" onClick={() => onAddRequest(collection.id)}>
          <Plus size={14} />
        </button>
        <button
          className="icon-button ghost"
          aria-label={`Rename ${collection.name}`}
          title="Rename collection"
          onClick={(event) => {
            event.stopPropagation()
            onRenameCollection(collection)
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      {open && (
        <div className="request-list">
          {collection.requests.map((request) => (
            <div className="request-node" key={request.id}>
              <div
                className={request.id === selectedRequestId ? 'request-row selected' : 'request-row'}
                onContextMenu={(event) => openFromContextMenu(event, request, onOpenRequestMenu)}
              >
                <button className="request-select" onClick={() => onSelectRequest(request)}>
                  <span className={`method-label method-${request.method.toLowerCase()}`}>
                    {request.method}
                  </span>
                  <span>{request.name}</span>
                </button>
                <button
                  className="request-more"
                  aria-label={`Actions for ${request.name}`}
                  aria-haspopup="menu"
                  aria-expanded={openRequestMenuId === request.id}
                  title="Request actions"
                  onClick={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    onOpenRequestMenu(request, bounds.right + 4, bounds.top)
                  }}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
              {request.examples.map((example) => (
                <button
                  className="request-example"
                  key={example.id}
                  onClick={() => onSelectExample(request, example)}
                >
                  <ExternalLink size={11} />
                  <span>{example.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuButton({
  icon,
  label,
  shortcut,
  danger,
  onClick,
  ref
}: {
  icon: React.ReactNode
  label: string
  shortcut?: string
  danger?: boolean
  onClick: () => void
  ref?: React.Ref<HTMLButtonElement>
}): React.JSX.Element {
  return (
    <button
      ref={ref}
      className={danger ? 'request-menu-item danger' : 'request-menu-item'}
      role="menuitem"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  )
}

function openFromContextMenu(
  event: MouseEvent,
  request: ApiRequest,
  onOpen: (request: ApiRequest, x: number, y: number) => void
): void {
  event.preventDefault()
  onOpen(request, event.clientX, event.clientY)
}

function menuPosition(x: number, y: number): { x: number; y: number } {
  const width = 226
  const height = 330
  const padding = 8
  return {
    x: Math.max(padding, Math.min(x, window.innerWidth - width - padding)),
    y: Math.max(padding, Math.min(y, window.innerHeight - height - padding))
  }
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
