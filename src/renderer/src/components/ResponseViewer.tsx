import { Braces, Check, Clock3, Copy, Database, FileJson2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ResponseSnapshot } from '../../../shared/domain'
import { tokenizeJson } from '../lib/json-highlighter'
import {
  findNextMatch,
  lineText,
  lineIndexAtOffset,
  prepareResponseBody,
  RESPONSE_LINE_HEIGHT,
  visibleLineRange,
  type PreparedResponseBody
} from '../lib/response-body'

export function ResponseViewer({
  response,
  sending
}: {
  response: ResponseSnapshot | null
  sending: boolean
}): React.JSX.Element {
  const [tab, setTab] = useState<'body' | 'headers'>('body')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const formattedBody = useMemo(() => prepareResponseBody(response?.body ?? ''), [response?.body])

  const copyBody = async (): Promise<void> => {
    if (!response) return
    try {
      await window.postblack.clipboard.copyText(response.body)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
    }
  }

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
        <div className="response-actions">
          <nav className="tabs compact">
            <button className={tab === 'body' ? 'tab active' : 'tab'} onClick={() => setTab('body')}>
              Body
            </button>
            <button className={tab === 'headers' ? 'tab active' : 'tab'} onClick={() => setTab('headers')}>
              Headers <span>{response.headers.length}</span>
            </button>
          </nav>
          <button
            className="response-copy"
            onClick={() => void copyBody()}
            title="Copy complete response body"
          >
            {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
            <span>
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy body'}
            </span>
          </button>
        </div>
      </header>
      {response.error ? (
        <div className="response-error">{response.error}</div>
      ) : (
        <>
          <ResponseBody key={response.id} prepared={formattedBody} hidden={tab !== 'body'} />
          {tab === 'headers' && (
            <div className="response-headers">
              {response.headers.map((header) => (
                <div key={header.id}>
                  <strong>{header.key}</strong>
                  <span>{header.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {(response.contentType || formattedBody.isJson) && (
        <footer className="response-footer">
          <span className="response-content-type">
            <Braces size={13} /> {response.contentType || 'application/json'}
          </span>
          {formattedBody.isJson && <JsonLegend />}
        </footer>
      )}
    </section>
  )
}

function ResponseBody({
  prepared,
  hidden
}: {
  prepared: PreparedResponseBody
  hidden: boolean
}): React.JSX.Element {
  const scrollRef = useRef<HTMLPreElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(400)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchOffset, setMatchOffset] = useState<number | null>(null)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element || !prepared.lineStarts) return
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight))
    observer.observe(element)
    setViewportHeight(element.clientHeight)
    return () => observer.disconnect()
  }, [prepared.lineStarts])

  if (!prepared.lineStarts) {
    return (
      <pre className="response-body code" hidden={hidden}>
        <code>
          {prepared.tokens
            ? prepared.tokens.map((token, index) => (
                <span className={`json-${token.kind}`} key={index}>
                  {token.value}
                </span>
              ))
            : prepared.text || '(empty response)'}
        </code>
      </pre>
    )
  }

  const starts = prepared.lineStarts
  const matchedLine = matchOffset === null ? null : lineIndexAtOffset(starts, matchOffset)
  const findNext = (): void => {
    if (!searchTerm) return
    const found = findNextMatch(prepared.text, searchTerm, matchOffset)
    setSearched(true)
    setMatchOffset(found)
    if (found !== null && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, lineIndexAtOffset(starts, found) - 2) * RESPONSE_LINE_HEIGHT
    }
  }
  const range = visibleLineRange(starts.length, scrollTop, viewportHeight)
  const visibleLines = []
  for (let index = range.start; index < range.end; index += 1) {
    const content = lineText(prepared.text, starts, index)
    visibleLines.push(
      <span
        className={index === matchedLine ? 'response-virtual-line match' : 'response-virtual-line'}
        key={index}
      >
        {prepared.isJson
          ? tokenizeJson(content).map((token, tokenIndex) => (
              <span className={`json-${token.kind}`} key={tokenIndex}>
                {token.value}
              </span>
            ))
          : content}
      </span>
    )
  }

  return (
    <div className="response-virtual-container" hidden={hidden}>
      <div className="response-search">
        <input
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value)
            setMatchOffset(null)
            setSearched(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') findNext()
          }}
          placeholder="Find in complete response"
          aria-label="Find in complete response"
        />
        <button onClick={findNext} disabled={!searchTerm}>
          Find next
        </button>
        {searched && <span>{matchedLine === null ? 'No match' : `Line ${matchedLine + 1}`}</span>}
      </div>
      <pre
        ref={scrollRef}
        className="response-body response-body-virtual code"
        onScroll={(event) => {
          const nextTop = event.currentTarget.scrollTop
          setScrollTop((currentTop) =>
            Math.floor(currentTop / RESPONSE_LINE_HEIGHT) === Math.floor(nextTop / RESPONSE_LINE_HEIGHT)
              ? currentTop
              : nextTop
          )
        }}
      >
        <code>
          <span
            className="response-virtual-spacer"
            style={{ height: range.start * RESPONSE_LINE_HEIGHT }}
            aria-hidden="true"
          />
          {visibleLines}
          <span
            className="response-virtual-spacer"
            style={{ height: (starts.length - range.end) * RESPONSE_LINE_HEIGHT }}
            aria-hidden="true"
          />
        </code>
      </pre>
    </div>
  )
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
