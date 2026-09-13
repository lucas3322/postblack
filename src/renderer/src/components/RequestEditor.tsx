import { Check, Code2, Eye, EyeOff, Save, Send, Variable } from 'lucide-react'
import { useState } from 'react'
import { isCurlCommand } from '../../../shared/curl'
import { type ApiRequest, type RequestAuth } from '../../../shared/domain'
import type { VariableDetail } from '../../../shared/variables'
import { JsonBodyEditor } from './JsonBodyEditor'
import { AuthValueInput } from './AuthValueInput'
import { KeyValueEditor } from './KeyValueEditor'
import { MethodSelect } from './MethodSelect'
import { UrlEditor } from './UrlEditor'

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
          <BodyEditor request={request} variableDetails={variableDetails} onChange={patch} />
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
  variableDetails,
  onChange
}: {
  request: ApiRequest
  variableDetails: Record<string, VariableDetail>
  onChange: (patch: Partial<ApiRequest>) => void
}): React.JSX.Element {
  return (
    <div className="body-editor">
      <div className="body-modes">
        {(['none', 'json', 'text', 'form-urlencoded'] as const).map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              checked={request.body.mode === mode}
              onChange={() => onChange({ body: { ...request.body, mode } })}
            />{' '}
            {mode}
          </label>
        ))}
      </div>
      {request.body.mode === 'json' && (
        <JsonBodyEditor
          value={request.body.content}
          variableDetails={variableDetails}
          onChange={(content) => onChange({ body: { ...request.body, content } })}
        />
      )}
      {request.body.mode !== 'none' && request.body.mode !== 'json' && (
        <JsonBodyEditor
          syntax="plain"
          value={request.body.content}
          variableDetails={variableDetails}
          onChange={(content) => onChange({ body: { ...request.body, content } })}
        />
      )}
    </div>
  )
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
