import { useState } from 'react'
import type { ApiRequest, Workspace } from '../../../shared/domain'
import { Modal } from './Modal'

interface SaveRequestModalProps {
  request: ApiRequest
  workspace: Workspace
  onSave: (collectionId: string, folderId?: string) => void
  onClose: () => void
}

export function SaveRequestModal({
  request,
  workspace,
  onSave,
  onClose
}: SaveRequestModalProps): React.JSX.Element {
  const destinations = workspace.collections.flatMap((collection) => [
    { value: collection.id, label: collection.name },
    ...collection.folders.map((folder) => ({
      value: `${collection.id}:${folder.id}`,
      label: `${collection.name} / ${folder.name}`
    }))
  ])
  const [destination, setDestination] = useState(destinations[0]?.value ?? '')

  return (
    <Modal title="Save request" onClose={onClose}>
      <form
        className="text-input-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!destination) return
          const [collectionId, folderId] = destination.split(':')
          onSave(collectionId, folderId)
        }}
      >
        <p className="muted">
          “{request.name}” is currently an unsaved tab. Choose where it should be stored.
        </p>
        <label className="field-label">
          Collection or folder
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            {destinations.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {!destinations.length && (
          <p className="bearer-help warning">Create a collection before saving this request.</p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Keep unsaved
          </button>
          <button className="button primary" type="submit" disabled={!destination}>
            Save request
          </button>
        </div>
      </form>
    </Modal>
  )
}
