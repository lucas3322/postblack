import { Check, ChevronDown, Code2, Eye, EyeOff, Send, Variable } from 'lucide-react'
import { useState } from 'react'
import { isCurlCommand } from '../../../shared/curl'
import { HTTP_METHODS, type ApiRequest, type RequestAuth } from '../../../shared/domain'
import { KeyValueEditor } from './KeyValueEditor'

type RequestTab = 'params' | 'headers' | 'body' | 'auth'

interface RequestEditorProps {
  request: ApiRequest
  sending: boolean
  saveState: 'saved' | 'saving' | 'error'
  variableNames: string[]
  activeEnvironmentName: string | null
  onChange: (request: ApiRequest) => void
  onSend: () => void
  onOpenCurl: () => void
  onImportCurl: (command: string) => Promise<void>
  onOpenVariables: () => void
}

export function RequestEditor({
  request,
  sending,
  saveState,
  variableNames,
  activeEnvironmentName,
  onChange,
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
        <div className={`save-indicator ${saveState}`}>
          <Check size={13} /> {saveState === 'saved' ? 'Saved locally' : saveState}
        </div>
        <button className="button secondary" onClick={onOpenCurl}>
          <Code2 size={15} /> cURL
        </button>
      </div>
      <div className="url-bar">
        <div className={`method-select method-${request.method.toLowerCase()}`}>
          <select
            value={request.method}
            onChange={(event) => patch({ method: event.target.value as ApiRequest['method'] })}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>
        <input
          className="url-input code"
          value={request.url}
          onChange={(event) => patch({ url: event.target.value })}
          onPaste={handleUrlPaste}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !sending) onSend()
          }}
          placeholder={importingCurl ? 'Importing cURL…' : 'Paste a URL or complete cURL command'}
          disabled={importingCurl}
          spellCheck={false}
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
          />
        )}
        {tab === 'headers' && (
          <KeyValueEditor
            rows={request.headers}
            onChange={(headers) => patch({ headers })}
            keyPlaceholder="Header"
          />
        )}
        {tab === 'body' && <BodyEditor request={request} onChange={patch} />}
        {tab === 'auth' && (
          <AuthEditor
            key={request.id}
            auth={request.auth}
            variableNames={variableNames}
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
  onChange
}: {
  request: ApiRequest
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
      {request.body.mode !== 'none' && (
        <textarea
          className="code body-textarea"
          value={request.body.content}
          onChange={(event) => onChange({ body: { ...request.body, content: event.target.value } })}
          placeholder={request.body.mode === 'json' ? '{\n  "name": "Postblack"\n}' : 'Request body'}
          spellCheck={false}
        />
      )}
    </div>
  )
}

function AuthEditor({
  auth,
  variableNames,
  activeEnvironmentName,
  onOpenVariables,
  onChange
}: {
  auth: RequestAuth
  variableNames: string[]
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
            <input
              id="bearer-token"
              type={showToken || auth.token.trimStart().startsWith('{{') ? 'text' : 'password'}
              value={auth.token}
              onChange={(event) => patch({ token: event.target.value })}
              placeholder="{{access_token}} or paste a token"
              autoComplete="off"
              spellCheck={false}
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
            <input value={auth.username} onChange={(event) => patch({ username: event.target.value })} />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              value={auth.password}
              onChange={(event) => patch({ password: event.target.value })}
            />
          </label>
        </div>
      )}
      {auth.type === 'api-key' && (
        <div className="form-grid three">
          <label className="field-label">
            Key
            <input value={auth.apiKeyName} onChange={(event) => patch({ apiKeyName: event.target.value })} />
          </label>
          <label className="field-label">
            Value
            <input
              type="password"
              value={auth.apiKeyValue}
              onChange={(event) => patch({ apiKeyValue: event.target.value })}
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
