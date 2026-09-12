import { useState } from 'react'
import type { Workspace } from '../../../shared/domain'
import { Modal } from './Modal'

interface MoveCollectionModalProps {
  collectionName: string
  destinations: Workspace[]
  onMove: (workspaceId: string) => void
  onClose: () => void
}

export function MoveCollectionModal({
  collectionName,
  destinations,
  onMove,
  onClose
}: MoveCollectionModalProps): React.JSX.Element {
  const [workspaceId, setWorkspaceId] = useState(destinations[0]?.id ?? '')

  return (
    <Modal title="Move collection" onClose={onClose}>
      <form
        className="text-input-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (workspaceId) onMove(workspaceId)
        }}
      >
        <p className="muted">Move “{collectionName}” to another local workspace.</p>
        <label className="field-label">
          Destination workspace
          <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            {destinations.map((workspace) => (
              <option value={workspace.id} key={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={!workspaceId}>
            Move collection
          </button>
        </div>
      </form>
    </Modal>
  )
}
