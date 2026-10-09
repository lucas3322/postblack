import {
  AlertTriangle,
  Braces,
  FileJson,
  FolderOpen,
  Globe,
  Layers3,
  Loader2,
  Terminal,
  UploadCloud
} from 'lucide-react'
import { useState } from 'react'
import { createKeyValue, createRequest } from '../../../shared/domain'
import { importOpenApi, type ImportedOpenApi } from '../../../shared/openapi'
import { Modal } from './Modal'

export type ImportTab = 'curl' | 'openapi' | 'workspace'
type OpenApiSource = 'file' | 'url' | 'paste'

interface ImportModalProps {
  initialTab: ImportTab
  curlInput: string
  variables: Record<string, string>
  onCurlInput: (value: string) => void
  onImportCurl: () => void
  onImportOpenApi: (imported: ImportedOpenApi) => void
  onImportWorkspace: () => void
  onClose: () => void
}

const TABS: Array<{ id: ImportTab; label: string; icon: React.JSX.Element }> = [
  { id: 'curl', label: 'cURL', icon: <Terminal size={14} /> },
  { id: 'openapi', label: 'OpenAPI / Swagger', icon: <Braces size={14} /> },
  { id: 'workspace', label: 'Postblack workspace', icon: <Layers3 size={14} /> }
]

export function ImportModal({
  initialTab,
  curlInput,
  variables,
  onCurlInput,
  onImportCurl,
  onImportOpenApi,
  onImportWorkspace,
  onClose
}: ImportModalProps): React.JSX.Element {
  const [tab, setTab] = useState<ImportTab>(initialTab)

  return (
    <Modal title="Import" onClose={onClose} wide>
      <div className="import-tabs" role="tablist" aria-label="Import source">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'curl' && (
        <div className="import-pane">
          <p className="muted">
            Paste a cURL command. Method, URL, query params, headers, Basic/Bearer auth, JSON, multipart and
            GraphQL bodies are recognized. Tip: you can also paste a cURL straight into any URL bar.
          </p>
          <textarea
            className="code curl-area"
            value={curlInput}
            onChange={(event) => onCurlInput(event.target.value)}
            placeholder={
              "curl --request POST 'https://api.example.com/users' \\\n  --header 'Content-Type: application/json' \\\n  --data '{\"name\": \"Ada\"}'"
            }
            autoFocus
          />
          <div className="modal-actions">
            <button className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" disabled={!curlInput.trim()} onClick={onImportCurl}>
              Import request
            </button>
          </div>
        </div>
      )}

      {tab === 'openapi' && (
        <OpenApiImport variables={variables} onImport={onImportOpenApi} onClose={onClose} />
      )}

      {tab === 'workspace' && (
        <div className="import-pane">
          <button className="import-dropzone" onClick={onImportWorkspace}>
            <FolderOpen size={26} />
            <strong>Choose a .postblack.json file</strong>
            <span>Workspaces exported from Postblack are added alongside your current ones.</span>
          </button>
        </div>
      )}
    </Modal>
  )
}

function OpenApiImport({
  variables,
  onImport,
  onClose
}: {
  variables: Record<string, string>
  onImport: (imported: ImportedOpenApi) => void
  onClose: () => void
}): React.JSX.Element {
  const [source, setSource] = useState<OpenApiSource>('file')
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportedOpenApi | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const parse = (text: string, origin: string | null): void => {
    try {
      setPreview(importOpenApi(text))
      setFileName(origin)
      setError(null)
    } catch (parseError) {
      setPreview(null)
      setError(parseError instanceof Error ? parseError.message : 'Não foi possível ler a especificação.')
    }
  }

  const chooseFile = async (): Promise<void> => {
    try {
      const selected = await window.postblack.files.importJson()
      if (selected.canceled) return
      parse(selected.contents ?? '', selected.name ?? null)
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Não foi possível abrir o arquivo.')
    }
  }

  const fetchUrl = async (): Promise<void> => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      const request = createRequest('OpenAPI spec')
      request.url = url.trim()
      request.headers = [createKeyValue('Accept', 'application/json')]
      const response = await window.postblack.executeRequest({ request, variables })
      if (response.error) throw new Error(response.error)
      if (response.status >= 400)
        throw new Error(`O servidor respondeu ${response.status} ${response.statusText}.`)
      parse(response.body, response.url)
    } catch (fetchError) {
      setPreview(null)
      setError(fetchError instanceof Error ? fetchError.message : 'Não foi possível baixar a especificação.')
    } finally {
      setLoading(false)
    }
  }

  const readDroppedFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    if (file.size > 50_000_000) {
      setError('O arquivo excede o limite de 50 MB.')
      return
    }
    parse(await file.text(), file.name)
  }

  const folderCount = preview?.collection.folders.length ?? 0
  const baseUrl = preview?.variables.find((variable) => variable.key === 'base_url')?.value

  return (
    <div className="import-pane">
      <p className="muted">
        Turn an OpenAPI 3.x or Swagger 2.0 JSON spec into a collection: one folder per tag, path params as
        variables, example bodies, auth and a <code>{'{{base_url}}'}</code> variable.
      </p>

      <div className="segmented" role="radiogroup" aria-label="Spec source">
        {(
          [
            ['file', 'File', <FileJson key="file" size={13} />],
            ['url', 'URL', <Globe key="url" size={13} />],
            ['paste', 'Paste JSON', <Braces key="paste" size={13} />]
          ] as const
        ).map(([id, label, icon]) => (
          <button
            key={id}
            role="radio"
            aria-checked={source === id}
            className={source === id ? 'active' : ''}
            onClick={() => setSource(id)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {source === 'file' && (
        <button
          className={`import-dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => void chooseFile()}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void readDroppedFile(event.dataTransfer.files[0])
          }}
        >
          <UploadCloud size={26} />
          <strong>{fileName ?? 'Drop swagger.json here or click to browse'}</strong>
          <span>openapi.json, swagger.json — up to 50 MB</span>
        </button>
      )}

      {source === 'url' && (
        <form
          className="import-url-row"
          onSubmit={(event) => {
            event.preventDefault()
            void fetchUrl()
          }}
        >
          <input
            className="code"
            value={url}
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://api.example.com/swagger/v1/swagger.json"
            aria-label="Spec URL"
          />
          <button className="button secondary" type="submit" disabled={!url.trim() || loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <Globe size={14} />}
            Fetch
          </button>
        </form>
      )}

      {source === 'paste' && (
        <textarea
          className="code curl-area"
          value={pasted}
          autoFocus
          placeholder={
            '{\n  "openapi": "3.0.3",\n  "info": { "title": "My API", "version": "1.0.0" },\n  "paths": { … }\n}'
          }
          onChange={(event) => {
            setPasted(event.target.value)
            if (event.target.value.trim()) parse(event.target.value, null)
            else {
              setPreview(null)
              setError(null)
            }
          }}
        />
      )}

      {error && (
        <div className="import-error" role="alert">
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="import-preview">
          <div className="import-preview-head">
            <span className="import-preview-badge">
              {preview.format === 'swagger-2' ? 'Swagger 2.0' : 'OpenAPI 3'}
            </span>
            <strong>{preview.title}</strong>
            {preview.version && <small>v{preview.version}</small>}
          </div>
          <dl className="import-stats">
            <div>
              <dt>Requests</dt>
              <dd>{preview.operationCount}</dd>
            </div>
            <div>
              <dt>Folders</dt>
              <dd>{folderCount}</dd>
            </div>
            <div>
              <dt>Variables</dt>
              <dd>{preview.variables.length}</dd>
            </div>
          </dl>
          {baseUrl && (
            <p className="import-base-url">
              <code>{'{{base_url}}'}</code> → <code>{baseUrl}</code>
            </p>
          )}
          {preview.warnings.length > 0 && (
            <details className="import-warnings">
              <summary>
                <AlertTriangle size={13} /> {preview.warnings.length} warning
                {preview.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul>
                {preview.warnings.slice(0, 50).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          disabled={!preview || preview.operationCount === 0}
          onClick={() => preview && onImport(preview)}
        >
          Import {preview ? `${preview.operationCount} requests` : 'collection'}
        </button>
      </div>
    </div>
  )
}
