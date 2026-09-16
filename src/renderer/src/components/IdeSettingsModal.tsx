import { useState } from 'react'
import { Modal } from './Modal'

export type IdeTheme = 'dark' | 'light'
export type ColorVisionMode = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome'

interface IdeSettingsModalProps {
  theme: IdeTheme
  colorVision: ColorVisionMode
  onSave: (theme: IdeTheme, colorVision: ColorVisionMode) => void
  onClose: () => void
}

export function IdeSettingsModal({
  theme,
  colorVision,
  onSave,
  onClose
}: IdeSettingsModalProps): React.JSX.Element {
  const [nextTheme, setNextTheme] = useState(theme)
  const [nextColorVision, setNextColorVision] = useState(colorVision)

  return (
    <Modal title="IDE settings" onClose={onClose}>
      <form
        className="ide-settings-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(nextTheme, nextColorVision)
        }}
      >
        <label className="field-label">
          Appearance
          <select value={nextTheme} onChange={(event) => setNextTheme(event.target.value as IdeTheme)}>
            <option value="dark">Dark</option>
            <option value="light">White / light</option>
          </select>
        </label>
        <label className="field-label">
          Color vision
          <select
            value={nextColorVision}
            onChange={(event) => setNextColorVision(event.target.value as ColorVisionMode)}
          >
            <option value="normal">Normal</option>
            <option value="protanopia">Protanopia (red-weak)</option>
            <option value="deuteranopia">Deuteranopia (green-weak)</option>
            <option value="tritanopia">Tritanopia (blue-weak)</option>
            <option value="monochrome">Monochrome</option>
          </select>
        </label>
        <p className="ide-settings-hint">These preferences are saved locally on this computer.</p>
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            Save settings
          </button>
        </div>
      </form>
    </Modal>
  )
}
