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
  Palette,
  Pencil,
  Play,
  Plus,
  Search,
  Share2,
  Trash2
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type {
  ApiRequest,
  FolderColor,
  RequestCollection,
  RequestExample,
  RequestFolder,
  Workspace
} from '../../../shared/domain'
import type { FolderDropTarget } from '../lib/folder-move'
import type { RequestLocation } from '../lib/request-move'

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
  onChangeFolderColor: (collection: RequestCollection, folder: RequestFolder, color: FolderColor) => void
  onRunCollection: (collection: RequestCollection) => void
  onMoveCollection: (collection: RequestCollection) => void
  onAddRequest: (collectionId: string, folderId?: string) => void
  onMoveRequest: (requestId: string, target: RequestLocation) => void
  onMoveFolder: (folderId: string, target: FolderDropTarget) => void
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

interface FolderColorMenuState {
  collection: RequestCollection
  folder: RequestFolder
  x: number
  y: number
}

interface DraggedRequest extends RequestLocation {
  requestId: string
}

interface DraggedFolder {
  folderId: string
  collectionId: string
  index: number
}

interface FolderDropIndicator extends FolderDropTarget {
  folderId?: string
  edge?: 'before' | 'after'
}

const FOLDER_COLOR_OPTIONS: Array<{ value: FolderColor; label: string; color: string }> = [
  { value: 'default', label: 'Default', color: '#879ab1' },
  { value: 'blue', label: 'Blue', color: '#4d9fff' },
  { value: 'cyan', label: 'Cyan', color: '#35c9d7' },
  { value: 'green', label: 'Green', color: '#42c98b' },
  { value: 'yellow', label: 'Yellow', color: '#e6c34f' },
  { value: 'orange', label: 'Orange', color: '#f29a49' },
  { value: 'red', label: 'Red', color: '#ef6b73' },
  { value: 'purple', label: 'Purple', color: '#9c7cf4' },
  { value: 'pink', label: 'Pink', color: '#e879b2' }
]

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
  onChangeFolderColor,
  onRunCollection,
  onMoveCollection,
  onAddRequest,
  onMoveRequest,
  onMoveFolder,
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
  const [folderColorMenu, setFolderColorMenu] = useState<FolderColorMenuState | null>(null)
  const [draggedRequest, setDraggedRequest] = useState<DraggedRequest | null>(null)
  const [dropTarget, setDropTarget] = useState<RequestLocation | null>(null)
  const [draggedFolder, setDraggedFolder] = useState<DraggedFolder | null>(null)
  const [folderDropTarget, setFolderDropTarget] = useState<FolderDropIndicator | null>(null)
  const firstMenuItem = useRef<HTMLButtonElement>(null)
  const collections = useMemo(
    () => filterCollections(workspace.collections, query),
    [workspace.collections, query]
  )

  useEffect(() => {
    if (!requestMenu && !collectionMenu && !folderColorMenu) return

    firstMenuItem.current?.focus()
    const close = (): void => {
      setRequestMenu(null)
      setCollectionMenu(null)
      setFolderColorMenu(null)
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
  }, [requestMenu, collectionMenu, folderColorMenu])

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

  const openFolderColorMenu = (
    collection: RequestCollection,
    folder: RequestFolder,
    x: number,
    y: number
  ): void => {
    setRequestMenu(null)
    setCollectionMenu(null)
    setFolderColorMenu({ collection, folder, ...menuPosition(x, y, 150) })
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
            draggedRequest={draggedRequest}
            dropTarget={dropTarget}
            onDragRequest={setDraggedRequest}
            onDropTarget={setDropTarget}
            onMoveRequest={onMoveRequest}
            draggedFolder={draggedFolder}
            folderDropTarget={folderDropTarget}
            onDragFolder={setDraggedFolder}
            onFolderDropTarget={setFolderDropTarget}
            onMoveFolder={onMoveFolder}
            folderDraggingEnabled={!query.trim()}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
            onOpenFolderColorMenu={openFolderColorMenu}
            openFolderColorMenuId={folderColorMenu?.folder.id ?? null}
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
      {folderColorMenu &&
        createPortal(
          <div
            className="folder-color-menu"
            role="menu"
            aria-label={`Color for ${folderColorMenu.folder.name}`}
            style={{ left: folderColorMenu.x, top: folderColorMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="folder-color-menu-title">Folder color</span>
            <div className="folder-color-grid">
              {FOLDER_COLOR_OPTIONS.map((option) => {
                const selected = (folderColorMenu.folder.color ?? 'default') === option.value
                return (
                  <button
                    key={option.value}
                    className={`folder-color-swatch${selected ? ' selected' : ''}`}
                    style={{ '--swatch-color': option.color } as React.CSSProperties}
                    title={option.label}
                    aria-label={`${option.label}${selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => {
                      onChangeFolderColor(folderColorMenu.collection, folderColorMenu.folder, option.value)
                      setFolderColorMenu(null)
                    }}
                  />
                )
              })}
            </div>
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
  draggedRequest,
  dropTarget,
  onDragRequest,
  onDropTarget,
  onMoveRequest,
  draggedFolder,
  folderDropTarget,
  onDragFolder,
  onFolderDropTarget,
  onMoveFolder,
  folderDraggingEnabled,
  onRenameFolder,
  onDeleteFolder,
  onOpenFolderColorMenu,
  openFolderColorMenuId,
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
  draggedRequest: DraggedRequest | null
  dropTarget: RequestLocation | null
  onDragRequest: (request: DraggedRequest | null) => void
  onDropTarget: (target: RequestLocation | null) => void
  onMoveRequest: (requestId: string, target: RequestLocation) => void
  draggedFolder: DraggedFolder | null
  folderDropTarget: FolderDropIndicator | null
  onDragFolder: (folder: DraggedFolder | null) => void
  onFolderDropTarget: (target: FolderDropIndicator | null) => void
  onMoveFolder: (folderId: string, target: FolderDropTarget) => void
  folderDraggingEnabled: boolean
  onRenameFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onDeleteFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onOpenFolderColorMenu: (collection: RequestCollection, folder: RequestFolder, x: number, y: number) => void
  openFolderColorMenuId: string | null
  onRenameCollection: (collection: RequestCollection) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
  onOpenCollectionMenu: (collection: RequestCollection, x: number, y: number) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const collectionTarget = { collectionId: collection.id }
  const canDropOnCollection = canMoveRequest(draggedRequest, collectionTarget)
  const collectionIsTarget = sameRequestLocation(dropTarget, collectionTarget)
  const folderCollectionTarget = { collectionId: collection.id, index: collection.folders.length }
  const canDropFolderOnCollection = canMoveFolder(draggedFolder, folderCollectionTarget)
  const collectionIsFolderTarget = sameFolderTarget(folderDropTarget, folderCollectionTarget)
  return (
    <div className="collection-node">
      <div
        className={`${collection.id === selectedCollectionId ? 'collection-row selected' : 'collection-row'}${
          collectionIsTarget ? ' request-drop-target' : ''
        }${collectionIsFolderTarget ? ' folder-drop-target' : ''}`}
        onContextMenu={(event) => openCollectionFromContextMenu(event, collection, onOpenCollectionMenu)}
        onDragOver={(event) => {
          if (draggedFolder) {
            handleFolderDragOver(event, canDropFolderOnCollection, folderCollectionTarget, onFolderDropTarget)
          } else {
            handleDragOver(event, canDropOnCollection, collectionTarget, onDropTarget)
          }
        }}
        onDragLeave={(event) => {
          handleDragLeave(event, onDropTarget)
          handleFolderDragLeave(event, onFolderDropTarget)
        }}
        onDrop={(event) => {
          if (draggedFolder) {
            handleFolderDrop(
              event,
              draggedFolder,
              folderCollectionTarget,
              onMoveFolder,
              onDragFolder,
              onFolderDropTarget
            )
          } else {
            handleRequestDrop(
              event,
              draggedRequest,
              collectionTarget,
              onMoveRequest,
              onDragRequest,
              onDropTarget
            )
          }
        }}
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
              location={collectionTarget}
              draggedRequest={draggedRequest}
              onDragRequest={onDragRequest}
              onDropTarget={onDropTarget}
            />
          ))}
          {collection.folders.map((folder, index) => (
            <FolderNode
              key={folder.id}
              collection={collection}
              folder={folder}
              index={index}
              selectedRequestId={selectedRequestId}
              openRequestMenuId={openRequestMenuId}
              onAddRequest={onAddRequest}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onOpenFolderColorMenu={onOpenFolderColorMenu}
              colorMenuOpen={openFolderColorMenuId === folder.id}
              onSelectRequest={onSelectRequest}
              onSelectExample={onSelectExample}
              onOpenRequestMenu={onOpenRequestMenu}
              draggedRequest={draggedRequest}
              dropTarget={dropTarget}
              onDragRequest={onDragRequest}
              onDropTarget={onDropTarget}
              onMoveRequest={onMoveRequest}
              draggedFolder={draggedFolder}
              folderDropTarget={folderDropTarget}
              onDragFolder={onDragFolder}
              onFolderDropTarget={onFolderDropTarget}
              onMoveFolder={onMoveFolder}
              folderDraggingEnabled={folderDraggingEnabled}
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
  index,
  selectedRequestId,
  openRequestMenuId,
  onAddRequest,
  onRenameFolder,
  onDeleteFolder,
  onOpenFolderColorMenu,
  colorMenuOpen,
  onSelectRequest,
  onSelectExample,
  onOpenRequestMenu,
  draggedRequest,
  dropTarget,
  onDragRequest,
  onDropTarget,
  onMoveRequest,
  draggedFolder,
  folderDropTarget,
  onDragFolder,
  onFolderDropTarget,
  onMoveFolder,
  folderDraggingEnabled
}: {
  collection: RequestCollection
  folder: RequestFolder
  index: number
  selectedRequestId: string | null
  openRequestMenuId: string | null
  onAddRequest: (collectionId: string, folderId?: string) => void
  onRenameFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onDeleteFolder: (collection: RequestCollection, folder: RequestFolder) => void
  onOpenFolderColorMenu: (collection: RequestCollection, folder: RequestFolder, x: number, y: number) => void
  colorMenuOpen: boolean
  onSelectRequest: (request: ApiRequest, pinned?: boolean) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
  draggedRequest: DraggedRequest | null
  dropTarget: RequestLocation | null
  onDragRequest: (request: DraggedRequest | null) => void
  onDropTarget: (target: RequestLocation | null) => void
  onMoveRequest: (requestId: string, target: RequestLocation) => void
  draggedFolder: DraggedFolder | null
  folderDropTarget: FolderDropIndicator | null
  onDragFolder: (folder: DraggedFolder | null) => void
  onFolderDropTarget: (target: FolderDropIndicator | null) => void
  onMoveFolder: (folderId: string, target: FolderDropTarget) => void
  folderDraggingEnabled: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const folderTarget = { collectionId: collection.id, folderId: folder.id }
  const canDropOnFolder = canMoveRequest(draggedRequest, folderTarget)
  const folderIsTarget = sameRequestLocation(dropTarget, folderTarget)
  const folderIndicator =
    folderDropTarget?.collectionId === collection.id && folderDropTarget.folderId === folder.id
      ? folderDropTarget
      : null
  return (
    <div className="folder-node">
      <div
        className={`folder-row${folderIsTarget ? ' request-drop-target' : ''}${
          draggedFolder?.folderId === folder.id ? ' dragging' : ''
        }${!folderDraggingEnabled ? ' drag-disabled' : ''}${
          folderIndicator?.edge === 'before' ? ' folder-drop-before' : ''
        }${folderIndicator?.edge === 'after' ? ' folder-drop-after' : ''}`}
        draggable={folderDraggingEnabled}
        onDragStart={(event) => {
          if (!folderDraggingEnabled) return
          event.stopPropagation()
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/x-postblack-folder', folder.id)
          event.dataTransfer.setData('text/plain', folder.id)
          onDragRequest(null)
          onDropTarget(null)
          onDragFolder({ folderId: folder.id, collectionId: collection.id, index })
        }}
        onDragEnd={() => {
          onDragFolder(null)
          onFolderDropTarget(null)
        }}
        onDragOver={(event) => {
          if (draggedFolder) {
            const target = folderTargetAtPointer(event, collection.id, folder.id, index)
            handleFolderDragOver(event, canMoveFolder(draggedFolder, target), target, onFolderDropTarget)
          } else {
            handleDragOver(event, canDropOnFolder, folderTarget, onDropTarget)
          }
        }}
        onDragLeave={(event) => {
          handleDragLeave(event, onDropTarget)
          handleFolderDragLeave(event, onFolderDropTarget)
        }}
        onDrop={(event) => {
          if (draggedFolder) {
            const target = folderTargetAtPointer(event, collection.id, folder.id, index)
            handleFolderDrop(event, draggedFolder, target, onMoveFolder, onDragFolder, onFolderDropTarget)
          } else {
            handleRequestDrop(event, draggedRequest, folderTarget, onMoveRequest, onDragRequest, onDropTarget)
          }
        }}
      >
        <button className="collection-chevron" onClick={() => setOpen(!open)} aria-label="Toggle folder">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <button
          className="folder-select"
          onDoubleClick={() => onRenameFolder(collection, folder)}
          title={folderDraggingEnabled ? 'Double-click to rename · drag to move' : 'Double-click to rename'}
        >
          <FolderClosed size={14} style={{ color: folderColor(folder.color) }} />
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
          className="icon-button ghost folder-color-button"
          title="Change folder color"
          aria-label={`Change color for ${folder.name}`}
          aria-haspopup="menu"
          aria-expanded={colorMenuOpen}
          onClick={(event) => {
            event.stopPropagation()
            const bounds = event.currentTarget.getBoundingClientRect()
            onOpenFolderColorMenu(collection, folder, bounds.right + 4, bounds.top)
          }}
        >
          <Palette size={12} />
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
              location={folderTarget}
              draggedRequest={draggedRequest}
              onDragRequest={onDragRequest}
              onDropTarget={onDropTarget}
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
  onOpenRequestMenu,
  location,
  draggedRequest,
  onDragRequest,
  onDropTarget
}: {
  request: ApiRequest
  selectedRequestId: string | null
  openRequestMenuId: string | null
  onSelectRequest: (request: ApiRequest, pinned?: boolean) => void
  onSelectExample: (request: ApiRequest, example: RequestExample) => void
  onOpenRequestMenu: (request: ApiRequest, x: number, y: number) => void
  location: RequestLocation
  draggedRequest: DraggedRequest | null
  onDragRequest: (request: DraggedRequest | null) => void
  onDropTarget: (target: RequestLocation | null) => void
}): React.JSX.Element {
  return (
    <div className="request-node">
      <div
        className={`${request.id === selectedRequestId ? 'request-row selected' : 'request-row'}${
          draggedRequest?.requestId === request.id ? ' dragging' : ''
        }`}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', request.id)
          onDragRequest({ requestId: request.id, ...location })
        }}
        onDragEnd={() => {
          onDragRequest(null)
          onDropTarget(null)
        }}
        onContextMenu={(event) => openFromContextMenu(event, request, onOpenRequestMenu)}
      >
        <button
          className="request-select"
          onClick={(event) => onSelectRequest(request, event.detail >= 2)}
          title="Double-click to keep open · drag to move"
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

function handleDragOver(
  event: DragEvent<HTMLDivElement>,
  canDrop: boolean,
  target: RequestLocation,
  onDropTarget: (target: RequestLocation | null) => void
): void {
  if (!canDrop) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'move'
  onDropTarget(target)
}

function handleDragLeave(
  event: DragEvent<HTMLDivElement>,
  onDropTarget: (target: RequestLocation | null) => void
): void {
  const nextElement = event.relatedTarget
  if (nextElement instanceof Node && event.currentTarget.contains(nextElement)) return
  onDropTarget(null)
}

function handleRequestDrop(
  event: DragEvent<HTMLDivElement>,
  draggedRequest: DraggedRequest | null,
  target: RequestLocation,
  onMoveRequest: (requestId: string, target: RequestLocation) => void,
  onDragRequest: (request: DraggedRequest | null) => void,
  onDropTarget: (target: RequestLocation | null) => void
): void {
  if (!canMoveRequest(draggedRequest, target)) return
  event.preventDefault()
  event.stopPropagation()
  onMoveRequest(draggedRequest.requestId, target)
  onDragRequest(null)
  onDropTarget(null)
}

function canMoveRequest(
  draggedRequest: DraggedRequest | null,
  target: RequestLocation
): draggedRequest is DraggedRequest {
  return Boolean(draggedRequest && !sameRequestLocation(draggedRequest, target))
}

function sameRequestLocation(left: RequestLocation | null, right: RequestLocation): boolean {
  return Boolean(left && left.collectionId === right.collectionId && left.folderId === right.folderId)
}

function folderTargetAtPointer(
  event: DragEvent<HTMLDivElement>,
  collectionId: string,
  folderId: string,
  index: number
): FolderDropIndicator {
  const bounds = event.currentTarget.getBoundingClientRect()
  const edge = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  return { collectionId, folderId, edge, index: edge === 'before' ? index : index + 1 }
}

function handleFolderDragOver(
  event: DragEvent<HTMLDivElement>,
  canDrop: boolean,
  target: FolderDropIndicator,
  onDropTarget: (target: FolderDropIndicator | null) => void
): void {
  if (!canDrop) {
    onDropTarget(null)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'move'
  onDropTarget(target)
}

function handleFolderDragLeave(
  event: DragEvent<HTMLDivElement>,
  onDropTarget: (target: FolderDropIndicator | null) => void
): void {
  const nextElement = event.relatedTarget
  if (nextElement instanceof Node && event.currentTarget.contains(nextElement)) return
  onDropTarget(null)
}

function handleFolderDrop(
  event: DragEvent<HTMLDivElement>,
  draggedFolder: DraggedFolder | null,
  target: FolderDropTarget,
  onMoveFolder: (folderId: string, target: FolderDropTarget) => void,
  onDragFolder: (folder: DraggedFolder | null) => void,
  onDropTarget: (target: FolderDropIndicator | null) => void
): void {
  if (!canMoveFolder(draggedFolder, target)) return
  event.preventDefault()
  event.stopPropagation()
  onMoveFolder(draggedFolder.folderId, target)
  onDragFolder(null)
  onDropTarget(null)
}

function canMoveFolder(
  draggedFolder: DraggedFolder | null,
  target: FolderDropTarget
): draggedFolder is DraggedFolder {
  if (!draggedFolder) return false
  if (draggedFolder.collectionId !== target.collectionId) return true
  return target.index !== draggedFolder.index && target.index !== draggedFolder.index + 1
}

function sameFolderTarget(left: FolderDropIndicator | null, right: FolderDropTarget): boolean {
  return Boolean(left && left.collectionId === right.collectionId && left.index === right.index)
}

function folderColor(color: FolderColor | undefined): string {
  return FOLDER_COLOR_OPTIONS.find((option) => option.value === color)?.color ?? '#879ab1'
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
