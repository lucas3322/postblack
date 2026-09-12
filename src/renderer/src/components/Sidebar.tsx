import {
  ArrowDownAZ,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Files,
  FolderClosed,
  FolderPlus,
  History,
  Link,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Play,
  Plus,
  Search,
  Share2,
  Trash2
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type {
  ApiRequest,
  RequestCollection,
  RequestExample,
  RequestFolder,
  Workspace
} from '../../../shared/domain'

interface SidebarProps {
  workspace: Workspace
  selectedRequestId: string | null
  selectedCollectionId: string | null
  onSelectCollection: (collection: RequestCollection) => void
  onSelectRequest: (request: ApiRequest, pinned?: boolean) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onAddCollection: () => void
  onRenameCollection: (collection: RequestCollection) => void
  onCopyCollection: (collection: RequestCollection) => void
  onDuplicateCollection: (collection: RequestCollection) => void
  onSortCollection: (collection: RequestCollection) => void
  onDeleteCollection: (collection: RequestCollection) => void
  onAddFolder: (collection: RequestCollection) => void
  onRenameFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onDeleteFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onRunCollection: (collection: RequestCollection) => void
  onMoveCollection: (collection: RequestCollection) => void
  onAddRequest: (collectionId: string, folderId?: string) => void
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

interface CollectionMenuState {
  collection: RequestCollection
  x: number
  y: number
}

export function Sidebar({
  workspace,
  selectedRequestId,
  selectedCollectionId,
  onSelectCollection,
  onSelectRequest,
  onSelectExample,
  onAddCollection,
  onRenameCollection,
  onCopyCollection,
  onDuplicateCollection,
  onSortCollection,
  onDeleteCollection,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onRunCollection,
  onMoveCollection,
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
  const [collectionMenu, setCollectionMenu] = useState<CollectionMenuState | null>(null)
  const firstMenuItem = useRef<HTMLButtonElement>(null)
  const collections = useMemo(
    () => filterCollections(workspace.collections, query),
    [workspace.collections, query]
  )

  useEffect(() => {
    if (!requestMenu && !collectionMenu) return

    firstMenuItem.current?.focus()
    const close = (): void => {
      setRequestMenu(null)
      setCollectionMenu(null)
    }
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
  }, [requestMenu, collectionMenu])

  const openRequestMenu = (request: ApiRequest, x: number, y: number): void => {
    onSelectRequest(request)
    setCollectionMenu(null)
    setRequestMenu({ request, ...menuPosition(x, y) })
  }

  const openCollectionMenu = (collection: RequestCollection, x: number, y: number): void => {
    onSelectCollection(collection)
    setRequestMenu(null)
    setCollectionMenu({ collection, ...menuPosition(x, y, 390) })
  }

  const runMenuAction = (action: (request: ApiRequest) => void): void => {
    if (!requestMenu) return
    const request = requestMenu.request
    setRequestMenu(null)
    action(request)
  }

  const runCollectionAction = (action: (collection: RequestCollection) => void): void => {
    if (!collectionMenu) return
    const collection = collectionMenu.collection
    setCollectionMenu(null)
    action(collection)
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
            selectedCollectionId={selectedCollectionId}
            openRequestMenuId={requestMenu?.request.id ?? null}
            openCollectionMenuId={collectionMenu?.collection.id ?? null}
            onSelectCollection={onSelectCollection}
            onSelectRequest={onSelectRequest}
            onSelectExample={onSelectExample}
            onAddRequest={onAddRequest}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onRenameCollection={onRenameCollection}
            onOpenRequestMenu={openRequestMenu}
            onOpenCollectionMenu={openCollectionMenu}
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
      {collectionMenu &&
        createPortal(
          <div
            className="request-context-menu collection-context-menu"
            role="menu"
            aria-label={`Actions for ${collectionMenu.collection.name}`}
            style={{ left: collectionMenu.x, top: collectionMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <MenuButton
              ref={firstMenuItem}
              icon={<Plus size={15} />}
              label="Add request"
              onClick={() => runCollectionAction((collection) => onAddRequest(collection.id))}
            />
            <MenuButton
              icon={<FolderPlus size={15} />}
              label="Add folder"
              onClick={() => runCollectionAction(onAddFolder)}
            />
            <MenuButton
              icon={<Play size={15} />}
              label="Run collection"
              onClick={() => runCollectionAction(onRunCollection)}
            />
            <MenuButton
              icon={<Copy size={15} />}
              label="Copy as JSON"
              onClick={() => runCollectionAction(onCopyCollection)}
            />
            <div className="request-menu-separator" />
            <MenuButton
              icon={<Pencil size={15} />}
              label="Rename"
              shortcut="⌘E"
              onClick={() => runCollectionAction(onRenameCollection)}
            />
            <MenuButton
              icon={<Files size={15} />}
              label="Duplicate"
              shortcut="⌘D"
              onClick={() => runCollectionAction(onDuplicateCollection)}
            />
            <MenuButton
              icon={<MoveRight size={15} />}
              label="Move to workspace"
              onClick={() => runCollectionAction(onMoveCollection)}
            />
            <MenuButton
              icon={<ArrowDownAZ size={15} />}
              label="Sort requests A–Z"
              onClick={() => runCollectionAction(onSortCollection)}
            />
            <MenuButton
              danger
              icon={<Trash2 size={15} />}
              label="Delete"
              shortcut="⌫"
              onClick={() => runCollectionAction(onDeleteCollection)}
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
  selectedCollectionId,
  openRequestMenuId,
  openCollectionMenuId,
  onSelectCollection,
  onSelectRequest,
  onSelectExample,
  onAddRequest,
  onRenameFolder,
  onDeleteFolder,
  onRenameCollection,
  onOpenRequestMenu,
  onOpenCollectionMenu
}: {
  collection: RequestCollection
  selectedRequestId: string | null
  selectedCollectionId: string | null
  openRequestMenuId: string | null
  openCollectionMenuId: string | null
  onSelectCollection: (collection: RequestCollection) => void
  onSelectRequest: (request: ApiRequest, pinned?: boolean) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onAddRequest: (collectionId: string, folderId?: string) => void
  onRenameFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onDeleteFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onRenameCollection: (collection: RequestCollection) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
  onOpenCollectionMenu: (collection: RequestCollection, x: number, y: number) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="collection-node">
      <div
        className={collection.id === selectedCollectionId ? 'collection-row selected' : 'collection-row'}
        onContextMenu={(event) => openCollectionFromContextMenu(event, collection, onOpenCollectionMenu)}
      >
        <button className="collection-chevron" onClick={() => setOpen(!open)} aria-label="Toggle collection">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          className="collection-select"
          onClick={() => onSelectCollection(collection)}
          onDoubleClick={() => onRenameCollection(collection)}
          title="Double-click to rename collection"
        >
          <FolderClosed size={15} />
          <span>{collection.name}</span>
        </button>
        <button className="icon-button" title="Add request" onClick={() => onAddRequest(collection.id)}>
          <Plus size={14} />
        </button>
        <button
          className="icon-button ghost"
          aria-label={`Actions for ${collection.name}`}
          aria-haspopup="menu"
          aria-expanded={openCollectionMenuId === collection.id}
          title="Collection actions"
          onClick={(event) => {
            event.stopPropagation()
            const bounds = event.currentTarget.getBoundingClientRect()
            onOpenCollectionMenu(collection, bounds.right + 4, bounds.top)
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      {open && (
        <div className="request-list">
          {collection.requests.map((request) => (
            <RequestTreeItem
              key={request.id}
              request={request}
              selectedRequestId={selectedRequestId}
              openRequestMenuId={openRequestMenuId}
              onSelectRequest={onSelectRequest}
              onSelectExample={onSelectExample}
              onOpenRequestMenu={onOpenRequestMenu}
            />
          ))}
          {collection.folders.map((folder) => (
            <FolderNode
              key={folder.id}
              collection={collection}
              folder={folder}
              selectedRequestId={selectedRequestId}
              openRequestMenuId={openRequestMenuId}
              onAddRequest={onAddRequest}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onSelectRequest={onSelectRequest}
              onSelectExample={onSelectExample}
              onOpenRequestMenu={onOpenRequestMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderNode({
  collection,
  folder,
  selectedRequestId,
  openRequestMenuId,
  onAddRequest,
  onRenameFolder,
  onDeleteFolder,
  onSelectRequest,
  onSelectExample,
  onOpenRequestMenu
}: {
  collection: RequestCollection
  folder: RequestFolder
  selectedRequestId: string | null
  openRequestMenuId: string | null
  onAddRequest: (collectionId: string, folderId?: string) => void
  onRenameFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onDeleteFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onSelectRequest: (request: ApiRequest, pinned?: boolean) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className="folder-node">
      <div className="folder-row">
        <button className="collection-chevron" onClick={() => setOpen(!open)} aria-label="Toggle folder">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          className="folder-select"
          onDoubleClick={() => onRenameFolder(collection, folder)}
          title="Double-click to rename folder"
        >
          <FolderClosed size={14} />
          <span>{folder.name}</span>
        </button>
        <button
          className="icon-button ghost"
          title="Add request to folder"
          onClick={() => onAddRequest(collection.id, folder.id)}
        >
          <Plus size={13} />
        </button>
        <button
          className="icon-button ghost folder-delete"
          title="Delete folder"
          onClick={() => onDeleteFolder(collection, folder)}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {open && (
        <div className="folder-request-list">
          {folder.requests.map((request) => (
            <RequestTreeItem
              key={request.id}
              request={request}
              selectedRequestId={selectedRequestId}
              openRequestMenuId={openRequestMenuId}
              onSelectRequest={onSelectRequest}
              onSelectExample={onSelectExample}
              onOpenRequestMenu={onOpenRequestMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestTreeItem({
  request,
  selectedRequestId,
  openRequestMenuId,
  onSelectRequest,
  onSelectExample,
  onOpenRequestMenu
}: {
  request: ApiRequest
  selectedRequestId: string | null
  openRequestMenuId: string | null
  onSelectRequest: (request: ApiRequest, pinned?: boolean) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
}): React.JSX.Element {
  return (
    <div className="request-node">
      <div
        className={request.id === selectedRequestId ? 'request-row selected' : 'request-row'}
        onContextMenu={(event) => openFromContextMenu(event, request, onOpenRequestMenu)}
      >
        <button
          className="request-select"
          onClick={(event) => onSelectRequest(request, event.detail >= 2)}
          title="Double-click to keep this request open"
        >
          <span className={`method-label method-${request.method.toLowerCase()}`}>{request.method}</span>
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

function openCollectionFromContextMenu(
  event: MouseEvent,
  collection: RequestCollection,
  onOpen: (collection: RequestCollection, x: number, y: number) => void
): void {
  event.preventDefault()
  onOpen(collection, event.clientX, event.clientY)
}

function menuPosition(x: number, y: number, height = 330): { x: number; y: number } {
  const width = 226
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
      ),
      folders: collection.folders
        .map((folder) => ({
          ...folder,
          requests: folder.requests.filter(
            (request) =>
              request.name.toLowerCase().includes(normalized) ||
              request.url.toLowerCase().includes(normalized)
          )
        }))
        .filter((folder) => folder.name.toLowerCase().includes(normalized) || folder.requests.length > 0)
    }))
    .filter(
      (collection) =>
        collection.name.toLowerCase().includes(normalized) ||
        collection.requests.length > 0 ||
        collection.folders.length > 0
    )
}
