import { useState } from 'react'
import { Modal } from './Modal'

interface TextInputModalProps {
  title: string
  label: string
  initialValue: string
  submitLabel: string
  onSubmit: (value: string) => void
  onClose: () => void
}

export function TextInputModal({
  title,
  label,
  initialValue,
  submitLabel,
  onSubmit,
  onClose
}: TextInputModalProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue)

  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="text-input-form"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = value.trim()
          if (trimmed) onSubmit(trimmed)
        }}
      >
        <label className="field-label">
          {label}
          <input value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </label>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={!value.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
