import { useRef, useState } from 'react'
import type { Workspace } from '../../../shared/domain'
import { Modal } from './Modal'

export type IdeTheme = 'dark' | 'light'
export type ColorVisionMode = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome'
export type IdeDensity = 'comfortable' | 'compact'
export type IdeFontSize = 'small' | 'medium' | 'large'

export interface IdePreferences {
  theme: IdeTheme
  colorVision: ColorVisionMode
  density: IdeDensity
  fontSize: IdeFontSize
  reduceMotion: boolean
}

interface IdeSettingsModalProps {
  preferences: IdePreferences
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  onSave: (preferences: IdePreferences) => void
  onActivateWorkspace: (workspaceId: string) => void
  onExportWorkspace: (workspace: Workspace) => void
  onImportWorkspace: (file: File) => void
  onExportAllData: () => void
  onClose: () => void
}

type SettingsSection = 'general' | 'appearance' | 'accessibility' | 'workspaces' | 'data'

export function IdeSettingsModal(props: IdeSettingsModalProps): React.JSX.Element {
  const [section, setSection] = useState<SettingsSection>('general')
  const [draft, setDraft] = useState(props.preferences)
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <Modal title="Configurações do Postblack" onClose={props.onClose} wide>
      <div className="ide-settings-layout">
        <nav className="ide-settings-nav" aria-label="Seções das configurações">
          <SettingsNav section="general" current={section} label="Geral" onSelect={setSection} />
          <SettingsNav section="appearance" current={section} label="Aparência" onSelect={setSection} />
          <SettingsNav
            section="accessibility"
            current={section}
            label="Acessibilidade"
            onSelect={setSection}
          />
          <SettingsNav section="workspaces" current={section} label="Workspaces" onSelect={setSection} />
          <SettingsNav section="data" current={section} label="Dados" onSelect={setSection} />
        </nav>

        <form
          className="ide-settings-content"
          onSubmit={(event) => {
            event.preventDefault()
            props.onSave(draft)
          }}
        >
          {section === 'general' && (
            <SettingsPanel title="Geral" description="Ajuste o comportamento e a densidade da interface.">
              <label className="field-label">
                Densidade da interface
                <select
                  value={draft.density}
                  onChange={(e) => setDraft({ ...draft, density: e.target.value as IdeDensity })}
                >
                  <option value="comfortable">Confortável</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
              <label className="field-label">
                Tamanho do texto
                <select
                  value={draft.fontSize}
                  onChange={(e) => setDraft({ ...draft, fontSize: e.target.value as IdeFontSize })}
                >
                  <option value="small">Pequeno</option>
                  <option value="medium">Médio</option>
                  <option value="large">Grande</option>
                </select>
              </label>
            </SettingsPanel>
          )}

          {section === 'appearance' && (
            <SettingsPanel
              title="Aparência"
              description="Escolha um tema construído para manter contraste e legibilidade."
            >
              <div className="theme-choice-grid">
                <ThemeChoice
                  value="dark"
                  selected={draft.theme}
                  label="Escuro"
                  onSelect={(theme) => setDraft({ ...draft, theme })}
                />
                <ThemeChoice
                  value="light"
                  selected={draft.theme}
                  label="Claro"
                  onSelect={(theme) => setDraft({ ...draft, theme })}
                />
              </div>
            </SettingsPanel>
          )}

          {section === 'accessibility' && (
            <SettingsPanel
              title="Acessibilidade"
              description="Adapte as cores e os movimentos às suas necessidades."
            >
              <label className="field-label">
                Visão de cores
                <select
                  value={draft.colorVision}
                  onChange={(e) => setDraft({ ...draft, colorVision: e.target.value as ColorVisionMode })}
                >
                  <option value="normal">Padrão</option>
                  <option value="protanopia">Protanopia — dificuldade com vermelho</option>
                  <option value="deuteranopia">Deuteranopia — dificuldade com verde</option>
                  <option value="tritanopia">Tritanopia — dificuldade com azul</option>
                  <option value="monochrome">Monocromático</option>
                </select>
              </label>
              <label className="settings-check-row">
                <input
                  type="checkbox"
                  checked={draft.reduceMotion}
                  onChange={(e) => setDraft({ ...draft, reduceMotion: e.target.checked })}
                />
                <span>
                  <strong>Reduzir animações</strong>
                  <small>Remove transições e movimentos não essenciais.</small>
                </span>
              </label>
              <div
                className={`vision-preview vision-preview-${draft.colorVision}`}
                aria-label="Prévia das cores"
              >
                <span className="preview-get">GET</span>
                <span className="preview-post">POST</span>
                <span className="preview-delete">DELETE</span>
                <span className="preview-info">INFO</span>
              </div>
            </SettingsPanel>
          )}

          {section === 'workspaces' && (
            <SettingsPanel title="Workspaces" description="Veja, abra e exporte todos os workspaces locais.">
              <div className="settings-workspace-list">
                {props.workspaces.map((workspace) => {
                  const requests = workspace.collections.reduce(
                    (total, collection) =>
                      total +
                      collection.requests.length +
                      collection.folders.reduce((sum, folder) => sum + folder.requests.length, 0),
                    0
                  )
                  return (
                    <article className="settings-workspace-card" key={workspace.id}>
                      <div>
                        <strong>{workspace.name}</strong>
                        <small>
                          {workspace.collections.length} collections · {requests} requests
                        </small>
                      </div>
                      <div className="settings-card-actions">
                        {workspace.id !== props.activeWorkspaceId && (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => props.onActivateWorkspace(workspace.id)}
                          >
                            Abrir
                          </button>
                        )}
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => props.onExportWorkspace(workspace)}
                        >
                          Exportar
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </SettingsPanel>
          )}

          {section === 'data' && (
            <SettingsPanel title="Dados" description="Faça backup ou restaure workspaces em formato JSON.">
              <div className="settings-data-actions">
                <button type="button" className="button secondary" onClick={() => fileInput.current?.click()}>
                  Importar workspace
                </button>
                <button type="button" className="button secondary" onClick={props.onExportAllData}>
                  Exportar todos os dados
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) props.onImportWorkspace(file)
                    event.target.value = ''
                  }}
                />
              </div>
              <p className="settings-note">
                A importação cria uma cópia independente e não sobrescreve seus workspaces atuais.
              </p>
            </SettingsPanel>
          )}

          <div className="modal-actions ide-settings-actions">
            <button className="button secondary" type="button" onClick={props.onClose}>
              Cancelar
            </button>
            <button className="button primary" type="submit">
              Salvar configurações
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function SettingsNav({
  section,
  current,
  label,
  onSelect
}: {
  section: SettingsSection
  current: SettingsSection
  label: string
  onSelect: (section: SettingsSection) => void
}): React.JSX.Element {
  return (
    <button type="button" className={current === section ? 'active' : ''} onClick={() => onSelect(section)}>
      {label}
    </button>
  )
}

function SettingsPanel({
  title,
  description,
  children
}: {
  title: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="settings-panel">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="settings-panel-fields">{children}</div>
    </section>
  )
}

function ThemeChoice({
  value,
  selected,
  label,
  onSelect
}: {
  value: IdeTheme
  selected: IdeTheme
  label: string
  onSelect: (theme: IdeTheme) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`theme-choice ${value}${selected === value ? ' selected' : ''}`}
      onClick={() => onSelect(value)}
    >
      <span className="theme-choice-preview">
        <i />
        <i />
        <i />
      </span>
      <strong>{label}</strong>
    </button>
  )
}
