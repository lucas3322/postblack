import { Copy, Files, FolderOpen, FolderPlus, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import type { RequestCollection } from '../../../shared/domain'

interface CollectionOverviewProps {
  collection: RequestCollection
  onChange: (collection: RequestCollection) => void
  onAddRequest: () => void
  onAddFolder: () => void
  onRun: () => void
  onRename: () => void
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function CollectionOverview({
  collection,
  onChange,
  onAddRequest,
  onAddFolder,
  onRun,
  onRename,
  onCopy,
  onDuplicate,
  onDelete
}: CollectionOverviewProps): React.JSX.Element {
  const requestCount =
    collection.requests.length +
    collection.folders.reduce((total, folder) => total + folder.requests.length, 0)

  return (
    <section className="collection-overview">
      <header className="collection-overview-header">
        <div>
          <span className="collection-eyebrow">Collection</span>
          <h1 onDoubleClick={onRename} title="Double-click to rename collection">
            {collection.name}
          </h1>
        </div>
        <div className="collection-overview-actions">
          <button className="button secondary" onClick={onRename}>
            <Pencil size={14} /> Rename
          </button>
          <button className="button secondary" onClick={onRun}>
            <Play size={14} /> Run
          </button>
          <button className="button primary" onClick={onAddRequest}>
            <Plus size={15} /> Add request
          </button>
        </div>
      </header>

      <nav className="collection-tabs" aria-label="Collection sections">
        <button className="active">Overview</button>
      </nav>

      <div className="collection-overview-content">
        <div className="collection-summary">
          <div className="collection-symbol">
            <FolderOpen size={28} />
          </div>
          <h2 onDoubleClick={onRename} title="Double-click to rename collection">
            {collection.name}
          </h2>
          <p>
            {requestCount} {requestCount === 1 ? 'request' : 'requests'} · {collection.folders.length}{' '}
            {collection.folders.length === 1 ? 'folder' : 'folders'} · created{' '}
            {formatDate(collection.createdAt)}
          </p>
        </div>

        <label className="collection-description">
          Description
          <textarea
            value={collection.description}
            onChange={(event) => onChange({ ...collection, description: event.target.value })}
            placeholder="Help people understand what this collection contains…"
          />
        </label>

        <div className="collection-quick-actions">
          <button onClick={onAddFolder}>
            <FolderPlus size={17} />
            <span>Add folder</span>
          </button>
          <button onClick={onCopy}>
            <Copy size={17} />
            <span>Copy as JSON</span>
          </button>
          <button onClick={onDuplicate}>
            <Files size={17} />
            <span>Duplicate collection</span>
          </button>
          <button className="danger" onClick={onDelete}>
            <Trash2 size={17} />
            <span>Delete collection</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value))
}
