import { Check, Code2, Eye, EyeOff, FileUp, Plus, Save, Send, Trash2, Variable, X } from 'lucide-react'
import { useState } from 'react'
import { isCurlCommand } from '../../../shared/curl'
import {
  createFormDataEntry,
  type ApiRequest,
  type FormDataEntry,
  type RequestAuth,
  type RequestBody
} from '../../../shared/domain'
import type { VariableDetail } from '../../../shared/variables'
import { JsonBodyEditor } from './JsonBodyEditor'
import { AuthValueInput } from './AuthValueInput'
import { KeyValueEditor } from './KeyValueEditor'
import { MethodSelect } from './MethodSelect'
import { UrlEditor } from './UrlEditor'
import { VariableValueInput } from './VariableValueInput'

type RequestTab = 'params' | 'headers' | 'body' | 'auth'

interface RequestEditorProps {
  request: ApiRequest
  sending: boolean
  saveState: 'saved' | 'saving' | 'error'
  dirty: boolean
  variableNames: string[]
  variableDetails?: Record<string, VariableDetail>
  activeEnvironmentName: string | null
  onChange: (request: ApiRequest) => void
  onSave: () => void
  onSend: () => void
  onOpenCurl: () => void
  onImportCurl: (command: string) => Promise<void>
  onOpenVariables: () => void
}

export function RequestEditor({
  request,
  sending,
  saveState,
  dirty,
  variableNames,
  variableDetails = {},
  activeEnvironmentName,
  onChange,
  onSave,
  onSend,
  onOpenCurl,
  onImportCurl,
  onOpenVariables
}: RequestEditorProps): React.JSX.Element {
  const [tab, setTab] = useState<RequestTab>('params')
  const [importingCurl, setImportingCurl] = useState(false)
  const patch = (changes: Partial<ApiRequest>): void =>
    onChange({ ...request, ...changes, updatedAt: new Date().toISOString() })

  const handleUrlPaste = (event: React.ClipboardEvent<HTMLInputElement>): void => {
    const pastedText = event.clipboardData.getData('text')
    if (!isCurlCommand(pastedText)) return

    event.preventDefault()
    setImportingCurl(true)
    void onImportCurl(pastedText).finally(() => setImportingCurl(false))
  }

  return (
    <section className="request-editor">
      <div className="request-title-row">
        <input
          className="request-name"
          value={request.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
        <div className={`save-indicator ${dirty ? 'unsaved' : saveState}`}>
          {dirty ? <span className="request-tab-dirty-dot" /> : <Check size={13} />}
          {dirty ? 'Unsaved changes' : saveState === 'saved' ? 'Saved locally' : saveState}
        </div>
        <button
          className="button secondary"
          onClick={onSave}
          disabled={!dirty}
          title="Save request (Ctrl/⌘+S)"
        >
          <Save size={15} /> Save
        </button>
        <button className="button secondary" onClick={onOpenCurl}>
          <Code2 size={15} /> cURL
        </button>
      </div>
      <div className="url-bar">
        <MethodSelect value={request.method} onChange={(method) => patch({ method })} />
        <UrlEditor
          key={request.id}
          value={request.url}
          variableNames={variableNames}
          variableDetails={variableDetails}
          importingCurl={importingCurl}
          sending={sending}
          onChange={(url) => patch({ url })}
          onPaste={handleUrlPaste}
          onSend={onSend}
          onOpenVariables={onOpenVariables}
        />
        <button
          className="button primary send-button"
          onClick={onSend}
          disabled={sending || importingCurl || !request.url.trim()}
        >
          <Send size={16} /> {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <nav className="tabs">
        <Tab
          label="Params"
          active={tab === 'params'}
          count={request.params.length}
          onClick={() => setTab('params')}
        />
        <Tab
          label="Headers"
          active={tab === 'headers'}
          count={request.headers.length}
          onClick={() => setTab('headers')}
        />
        <Tab label="Body" active={tab === 'body'} onClick={() => setTab('body')} />
        <Tab label="Auth" active={tab === 'auth'} onClick={() => setTab('auth')} />
      </nav>
      <div className="request-config">
        {tab === 'params' && (
          <KeyValueEditor
            rows={request.params}
            onChange={(params) => patch({ params })}
            keyPlaceholder="Parameter"
            variableNames={variableNames}
            variableDetails={variableDetails}
            onOpenVariables={onOpenVariables}
          />
        )}
        {tab === 'headers' && (
          <KeyValueEditor
            rows={request.headers}
            onChange={(headers) => patch({ headers })}
            keyPlaceholder="Header"
            variableNames={variableNames}
            variableDetails={variableDetails}
            onOpenVariables={onOpenVariables}
          />
        )}
        {tab === 'body' && (
          <BodyEditor
            request={request}
            variableNames={variableNames}
            variableDetails={variableDetails}
            onOpenVariables={onOpenVariables}
            onChange={patch}
          />
        )}
        {tab === 'auth' && (
          <AuthEditor
            key={request.id}
            auth={request.auth}
            variableNames={variableNames}
            variableDetails={variableDetails}
            activeEnvironmentName={activeEnvironmentName}
            onOpenVariables={onOpenVariables}
            onChange={(auth) => patch({ auth })}
          />
        )}
      </div>
    </section>
  )
}

function Tab({
  label,
  active,
  count,
  onClick
}: {
  label: string
  active: boolean
  count?: number
  onClick: () => void
}): React.JSX.Element {
  return (
    <button className={active ? 'tab active' : 'tab'} onClick={onClick}>
      {label}
      {Boolean(count) && <span>{count}</span>}
    </button>
  )
}

function BodyEditor({
  request,
  variableNames,
  variableDetails,
  onOpenVariables,
  onChange
}: {
  request: ApiRequest
  variableNames: string[]
  variableDetails: Record<string, VariableDetail>
  onOpenVariables: () => void
  onChange: (patch: Partial<ApiRequest>) => void
}): React.JSX.Element {
  const body = request.body
  const visibleMode = body.mode === 'json' || body.mode === 'text' ? 'raw' : body.mode
  const rawType = body.mode === 'json' ? 'json' : body.mode === 'text' ? 'text' : (body.rawType ?? 'json')
  const patchBody = (changes: Partial<RequestBody>): void => onChange({ body: { ...body, ...changes } })
  const selectFile = async (entry?: FormDataEntry): Promise<void> => {
    const result = await window.postblack.files.pickFile()
    if (result.canceled || !result.file) return
    if (entry) {
      patchBody({
        formData: (body.formData ?? []).map((item) =>
          item.id === entry.id ? { ...item, file: result.file ?? null, value: result.file?.name ?? '' } : item
        )
      })
      return
    }
    patchBody({ binaryFile: result.file })
  }

  return (
    <div className="body-editor">
      <div className="body-modes">
        {(
          [
            ['none', 'none'],
            ['form-data', 'form-data'],
            ['form-urlencoded', 'x-www-form-urlencoded'],
            ['raw', 'raw'],
            ['binary', 'binary'],
            ['graphql', 'GraphQL']
          ] as const
        ).map(([mode, label]) => (
          <label key={mode}>
            <input type="radio" checked={visibleMode === mode} onChange={() => patchBody({ mode })} /> {label}
          </label>
        ))}
      </div>

      {visibleMode === 'form-data' && (
        <FormDataBodyEditor
          rows={body.formData ?? []}
          variableNames={variableNames}
          variableDetails={variableDetails}
          onOpenVariables={onOpenVariables}
          onSelectFile={selectFile}
          onChange={(formData) => patchBody({ formData })}
        />
      )}

      {visibleMode === 'form-urlencoded' && (
        <KeyValueEditor
          rows={body.urlEncoded ?? []}
          onChange={(urlEncoded) => patchBody({ urlEncoded })}
          keyPlaceholder="Key"
          valuePlaceholder="Value"
          variableNames={variableNames}
          variableDetails={variableDetails}
          onOpenVariables={onOpenVariables}
        />
      )}

      {visibleMode === 'raw' && (
        <div className="raw-body-editor">
          <label className="raw-body-type">
            Formato
            <select
              value={rawType}
              onChange={(event) =>
                patchBody({ mode: 'raw', rawType: event.target.value as NonNullable<RequestBody['rawType']> })
              }
            >
              <option value="json">JSON</option>
              <option value="text">Texto</option>
              <option value="javascript">JavaScript</option>
              <option value="html">HTML</option>
              <option value="xml">XML</option>
            </select>
          </label>
          <JsonBodyEditor
            syntax={rawType === 'json' ? 'json' : 'plain'}
            value={body.content}
            variableDetails={variableDetails}
            onChange={(content) => patchBody({ mode: 'raw', content })}
          />
        </div>
      )}

      {visibleMode === 'binary' && (
        <div className="binary-body-picker">
          <FileUp size={24} />
          {body.binaryFile ? (
            <>
              <div>
                <strong>{body.binaryFile.name}</strong>
                <small>
                  {formatFileSize(body.binaryFile.size)} · {body.binaryFile.mimeType}
                </small>
              </div>
              <button type="button" className="button secondary" onClick={() => void selectFile()}>
                Trocar arquivo
              </button>
              <button
                type="button"
                className="icon-button danger"
                title="Remover arquivo"
                onClick={() => patchBody({ binaryFile: null })}
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>Nenhum arquivo selecionado</strong>
                <small>O conteúdo do arquivo será enviado como body da requisição.</small>
              </div>
              <button type="button" className="button secondary" onClick={() => void selectFile()}>
                Selecionar arquivo
              </button>
            </>
          )}
        </div>
      )}

      {visibleMode === 'graphql' && (
        <div className="graphql-body-editor">
          <label>
            Query
            <JsonBodyEditor
              syntax="plain"
              value={body.graphql?.query ?? ''}
              placeholder={'query GetUser {\n  user { id name }\n}'}
              ariaLabel="GraphQL query"
              variableDetails={variableDetails}
              onChange={(query) =>
                patchBody({ graphql: { query, variables: body.graphql?.variables ?? '' } })
              }
            />
          </label>
          <label>
            Variables (JSON)
            <JsonBodyEditor
              value={body.graphql?.variables ?? ''}
              placeholder={'{\n  "id": "{{user_id}}"\n}'}
              ariaLabel="GraphQL variables"
              variableDetails={variableDetails}
              onChange={(variables) =>
                patchBody({ graphql: { query: body.graphql?.query ?? '', variables } })
              }
            />
          </label>
        </div>
      )}
    </div>
  )
}

function FormDataBodyEditor({
  rows,
  variableNames,
  variableDetails,
  onOpenVariables,
  onSelectFile,
  onChange
}: {
  rows: FormDataEntry[]
  variableNames: string[]
  variableDetails: Record<string, VariableDetail>
  onOpenVariables: () => void
  onSelectFile: (entry: FormDataEntry) => Promise<void>
  onChange: (rows: FormDataEntry[]) => void
}): React.JSX.Element {
  const update = (id: string, patch: Partial<FormDataEntry>): void =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  return (
    <div className="form-data-editor">
      <div className="form-data-heading">
        <span>Ativo</span>
        <span>Key</span>
        <span>Tipo</span>
        <span>Value</span>
        <span>Descrição</span>
        <span />
      </div>
      {!rows.length && <div className="empty-inline">Nenhum campo ainda. Adicione um abaixo.</div>}
      {rows.map((row) => (
        <div className="form-data-row" key={row.id}>
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => update(row.id, { enabled: event.target.checked })}
          />
          <input
            value={row.key}
            placeholder="Key"
            onChange={(event) => update(row.id, { key: event.target.value })}
          />
          <select
            value={row.type}
            onChange={(event) => {
              const type = event.target.value as FormDataEntry['type']
              update(row.id, {
                type,
                file: type === 'file' ? row.file : null,
                value: type === 'file' ? '' : row.value
              })
            }}
          >
            <option value="text">Text</option>
            <option value="file">File</option>
          </select>
          {row.type === 'file' ? (
            <button type="button" className="form-data-file" onClick={() => void onSelectFile(row)}>
              <FileUp size={14} /> {row.file?.name ?? 'Selecionar arquivo'}
            </button>
          ) : (
            <VariableValueInput
              value={row.value}
              placeholder="Value"
              variableNames={variableNames}
              variableDetails={variableDetails}
              onChange={(value) => update(row.id, { value })}
              onOpenVariables={onOpenVariables}
            />
          )}
          <input
            value={row.description}
            placeholder="Descrição"
            onChange={(event) => update(row.id, { description: event.target.value })}
          />
          <button
            type="button"
            className="icon-button danger"
            title="Excluir campo"
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => onChange([...rows, createFormDataEntry()])}>
        <Plus size={14} /> Adicionar campo
      </button>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AuthEditor({
  auth,
  variableNames,
  variableDetails,
  activeEnvironmentName,
  onOpenVariables,
  onChange
}: {
  auth: RequestAuth
  variableNames: string[]
  variableDetails: Record<string, VariableDetail>
  activeEnvironmentName: string | null
  onOpenVariables: () => void
  onChange: (auth: RequestAuth) => void
}): React.JSX.Element {
  const [showToken, setShowToken] = useState(false)
  const patch = (changes: Partial<RequestAuth>): void => onChange({ ...auth, ...changes })
  const variableReference = /^\{\{\s*([^{}\s]+)\s*\}\}$/.exec(auth.token.trim())
  const missingVariable = variableReference && !variableNames.includes(variableReference[1])
  return (
    <div className="auth-editor">
      <label className="field-label">
        Authentication type
        <select
          value={auth.type}
          onChange={(event) => patch({ type: event.target.value as RequestAuth['type'] })}
        >
          <option value="none">No auth</option>
          <option value="bearer">Bearer token</option>
          <option value="basic">Basic auth</option>
          <option value="api-key">API key</option>
        </select>
      </label>
      {auth.type === 'none' && <p className="muted">This request will not add an authorization value.</p>}
      {auth.type === 'bearer' && (
        <div className="bearer-fields">
          <label className="field-label" htmlFor="bearer-token">
            Token
          </label>
          <div className="bearer-input">
            <AuthValueInput
              id="bearer-token"
              value={auth.token}
              onChange={(token) => patch({ token })}
              placeholder="{{access_token}} or paste a token"
              secret
              showRaw={showToken}
              variableDetails={variableDetails}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowToken((current) => !current)}
              title={showToken ? 'Hide token' : 'Show token'}
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="bearer-tools">
            <select
              aria-label="Use an existing variable for the token"
              value=""
              onChange={(event) => patch({ token: `{{${event.target.value}}}` })}
            >
              <option value="" disabled>
                Use a variable…
              </option>
              {variableNames.map((name) => (
                <option key={name} value={name}>{`{{${name}}}`}</option>
              ))}
            </select>
            <button type="button" className="text-button" onClick={onOpenVariables}>
              <Variable size={14} /> Manage variables
            </button>
          </div>
          <p className={missingVariable ? 'bearer-help warning' : 'bearer-help'}>
            {missingVariable
              ? `Variable ${variableReference[1]} not found. Create it or select the correct environment.`
              : `Use {{access_token}} here; the value comes from the active environment (${activeEnvironmentName ?? 'none'}), workspace or global variables. Do not include “Bearer”.`}
          </p>
        </div>
      )}
      {auth.type === 'basic' && (
        <div className="form-grid">
          <label className="field-label">
            Username
            <AuthValueInput
              value={auth.username}
              variableDetails={variableDetails}
              onChange={(username) => patch({ username })}
            />
          </label>
          <label className="field-label">
            Password
            <AuthValueInput
              secret
              value={auth.password}
              variableDetails={variableDetails}
              onChange={(password) => patch({ password })}
            />
          </label>
        </div>
      )}
      {auth.type === 'api-key' && (
        <div className="form-grid three">
          <label className="field-label">
            Key
            <AuthValueInput
              value={auth.apiKeyName}
              variableDetails={variableDetails}
              onChange={(apiKeyName) => patch({ apiKeyName })}
            />
          </label>
          <label className="field-label">
            Value
            <AuthValueInput
              secret
              value={auth.apiKeyValue}
              variableDetails={variableDetails}
              onChange={(apiKeyValue) => patch({ apiKeyValue })}
            />
          </label>
          <label className="field-label">
            Add to
            <select
              value={auth.apiKeyLocation}
              onChange={(event) => patch({ apiKeyLocation: event.target.value as 'header' | 'query' })}
            >
              <option value="header">Header</option>
              <option value="query">Query</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
