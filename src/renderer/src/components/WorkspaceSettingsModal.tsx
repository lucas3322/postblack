import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Workspace } from '../../../shared/domain'
import { Modal } from './Modal'

interface WorkspaceSettingsModalProps {
  workspace: Workspace
  canDelete: boolean
  onSave: (name: string, description: string) => void
  onDelete: () => void
  onClose: () => void
}

export function WorkspaceSettingsModal({
  workspace,
  canDelete,
  onSave,
  onDelete,
  onClose
}: WorkspaceSettingsModalProps): React.JSX.Element {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <Modal title="Workspace settings" onClose={onClose} wide>
      <form
        className="workspace-create-form"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = name.trim()
          if (trimmed) onSave(trimmed, description.trim())
        }}
      >
        <label className="field-label">
          Workspace name
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <label className="field-label">
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <p className="workspace-settings-hint">This workspace is stored locally on this computer.</p>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={!name.trim()}>
            Save changes
          </button>
        </div>
      </form>

      <section className="workspace-danger-zone" aria-label="Delete workspace">
        {confirmingDelete ? (
          <>
            <div className="workspace-danger-copy">
              <strong>Delete “{workspace.name}”?</strong>
              <span>
                {deleteSummary(workspace)} This can’t be undone — export it first if you may need it.
              </span>
            </div>
            <div className="workspace-danger-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setConfirmingDelete(false)}
                autoFocus
              >
                Keep workspace
              </button>
              <button className="button danger" type="button" onClick={onDelete}>
                <Trash2 size={14} />
                Delete workspace
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="workspace-danger-copy">
              <strong>Delete workspace</strong>
              <span>
                {canDelete
                  ? 'Removes this workspace and everything in it from this computer.'
                  : 'You need at least one workspace. Create another one before deleting this.'}
              </span>
            </div>
            <button
              className="button danger-outline"
              type="button"
              disabled={!canDelete}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={14} />
              Delete…
            </button>
          </>
        )}
      </section>
    </Modal>
  )
}

function deleteSummary(workspace: Workspace): string {
  const collections = workspace.collections.length
  const requests = workspace.collections.reduce(
    (total, collection) =>
      total +
      collection.requests.length +
      collection.folders.reduce((sum, folder) => sum + folder.requests.length, 0),
    0
  )
  const environments = workspace.environments.length
  const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`
  return `${plural(collections, 'collection')}, ${plural(requests, 'request')} and ${plural(environments, 'environment')} will be removed.`
}
