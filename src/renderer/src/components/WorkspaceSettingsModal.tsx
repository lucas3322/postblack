import { useState } from 'react'
import type { Workspace } from '../../../shared/domain'
import { Modal } from './Modal'

interface WorkspaceSettingsModalProps {
  workspace: Workspace
  onSave: (name: string, description: string) => void
  onClose: () => void
}

export function WorkspaceSettingsModal({
  workspace,
  onSave,
  onClose
}: WorkspaceSettingsModalProps): React.JSX.Element {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)

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
    </Modal>
  )
}
