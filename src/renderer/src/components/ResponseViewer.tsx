import { Braces, Clock3, Database, FileJson2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ResponseSnapshot } from '../../../shared/domain'
import { tokenizeJson, type JsonToken } from '../lib/json-highlighter'

export function ResponseViewer({
  response,
  sending
}: {
  response: ResponseSnapshot | null
  sending: boolean
}): React.JSX.Element {
  const [tab, setTab] = useState<'body' | 'headers'>('body')
  const formattedBody = useMemo(() => prepareBody(response), [response])

  if (sending)
    return (
      <section className="response empty-response">
        <div className="loader" />
        <p>Sending request…</p>
      </section>
    )
  if (!response)
    return (
      <section className="response empty-response">
        <FileJson2 size={32} />
        <h3>Your response will appear here</h3>
        <p>Send the request to inspect status, headers, timing, size, and body.</p>
      </section>
    )

  return (
    <section className="response">
      <header className="response-header">
        <div>
          <span className={`status-pill ${response.status >= 400 || response.error ? 'bad' : ''}`}>
            {response.error ? 'ERROR' : `${response.status} ${response.statusText}`}
          </span>
          <span>
            <Clock3 size={14} /> {response.durationMs} ms
          </span>
          <span>
            <Database size={14} /> {formatBytes(response.sizeBytes)}
          </span>
        </div>
        <nav className="tabs compact">
          <button className={tab === 'body' ? 'tab active' : 'tab'} onClick={() => setTab('body')}>
            Body
          </button>
          <button className={tab === 'headers' ? 'tab active' : 'tab'} onClick={() => setTab('headers')}>
            Headers <span>{response.headers.length}</span>
          </button>
        </nav>
      </header>
      {response.error ? (
        <div className="response-error">{response.error}</div>
      ) : tab === 'body' ? (
        <pre className="response-body code">
          <code>
            {formattedBody.tokens
              ? formattedBody.tokens.map((token, index) => (
                  <span className={`json-${token.kind}`} key={`${index}-${token.kind}`}>
                    {token.value}
                  </span>
                ))
              : formattedBody.text || '(empty response)'}
          </code>
        </pre>
      ) : (
        <div className="response-headers">
          {response.headers.map((header) => (
            <div key={header.id}>
              <strong>{header.key}</strong>
              <span>{header.value}</span>
            </div>
          ))}
        </div>
      )}
      {(response.contentType || formattedBody.tokens) && (
        <footer className="response-footer">
          <span className="response-content-type">
            <Braces size={13} /> {response.contentType || 'application/json'}
          </span>
          {formattedBody.tokens && <JsonLegend />}
        </footer>
      )}
    </section>
  )
}

function prepareBody(response: ResponseSnapshot | null): { text: string; tokens: JsonToken[] | null } {
  if (!response) return { text: '', tokens: null }
  try {
    const formattedJson = JSON.stringify(JSON.parse(response.body), null, 2)
    return { text: formattedJson, tokens: tokenizeJson(formattedJson) }
  } catch {
    return { text: response.body, tokens: null }
  }
}

function JsonLegend(): React.JSX.Element {
  return (
    <span className="json-legend" aria-label="JSON value color legend">
      <span className="json-key">Key</span>
      <span className="json-string">String</span>
      <span className="json-number">Number</span>
      <span className="json-boolean">Boolean</span>
      <span className="json-null">Null</span>
    </span>
  )
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}
