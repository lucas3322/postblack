import { Braces, Check, Clock3, Copy, Database, FileJson2, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ResponseSnapshot } from '../../../shared/domain'
import { selectedResponseText } from '../lib/copy-selection'
import { MAX_HTML_PREVIEW_LENGTH, sandboxedHtmlDocument } from '../lib/html-preview'
import { responseCookies } from '../lib/response-cookies'
import { detectResponseFormat, RESPONSE_FORMATS, type ResponseFormat } from '../lib/response-format'
import { responseTokenClass, tokenizeResponseText } from '../lib/response-syntax'
import { ResponseVisualization, type VisualizationMode } from './ResponseVisualization'
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
  const [tab, setTab] = useState<'body' | 'headers' | 'cookies'>('body')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [chosenFormat, setChosenFormat] = useState<{ responseId: string; format: ResponseFormat } | null>(
    null
  )
  const [previewResponseId, setPreviewResponseId] = useState<string | null>(null)
  const [chosenVisualization, setChosenVisualization] = useState<{
    responseId: string
    mode: VisualizationMode
  } | null>(null)
  const responseRef = useRef<HTMLElement>(null)
  const selectedTextRef = useRef<string | null>(null)
  const detectedFormat = useMemo(
    () => detectResponseFormat(response?.contentType ?? '', response?.body ?? ''),
    [response?.body, response?.contentType]
  )
  const format = chosenFormat?.responseId === response?.id ? chosenFormat.format : detectedFormat
  const preview = previewResponseId === response?.id && format === 'HTML'
  const visualization =
    chosenVisualization?.responseId === response?.id && format === 'JSON' ? chosenVisualization.mode : null
  const formattedBody = useMemo(
    () => prepareResponseBody(response?.body ?? '', format),
    [response?.body, format]
  )
  const cookies = useMemo(() => responseCookies(response?.headers ?? []), [response?.headers])
  const highlightedResponseText = (): string | null => {
    const regions =
      responseRef.current?.querySelectorAll<HTMLElement>(
        '.response-body:not(.response-body-virtual):not([hidden]), .response-virtual-container:not([hidden]) .response-body-virtual, .response-headers, .response-cookies'
      ) ?? []
    return selectedResponseText(window.getSelection(), regions)
  }

  const copyBody = async (): Promise<void> => {
    if (!response) return
    try {
      const selectedText = selectedTextRef.current ?? highlightedResponseText()
      selectedTextRef.current = null
      await window.postblack.clipboard.copyText(selectedText ?? response.body)
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
    <section ref={responseRef} className="response">
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
            <button className={tab === 'cookies' ? 'tab active' : 'tab'} onClick={() => setTab('cookies')}>
              Cookies {cookies.length > 0 && <span>{cookies.length}</span>}
            </button>
            <button className={tab === 'headers' ? 'tab active' : 'tab'} onClick={() => setTab('headers')}>
              Headers <span>{response.headers.length}</span>
            </button>
          </nav>
          <button
            className="response-copy"
            onPointerDown={() => {
              selectedTextRef.current = highlightedResponseText()
            }}
            onClick={() => void copyBody()}
            title="Copy selected response text, or the complete body if nothing is selected"
          >
            {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
            <span>
              {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy body'}
            </span>
          </button>
        </div>
      </header>
      {tab === 'body' && !response.error && (
        <div className="response-format-toolbar">
          <select
            value={format}
            onChange={(event) => {
              setChosenFormat({ responseId: response.id, format: event.target.value as ResponseFormat })
              setPreviewResponseId(null)
              setChosenVisualization(null)
            }}
            aria-label="Response body format"
            title="Choose how to display this response"
          >
            {RESPONSE_FORMATS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={preview ? 'response-preview-toggle active' : 'response-preview-toggle'}
            disabled={format !== 'HTML' || response.body.length > MAX_HTML_PREVIEW_LENGTH}
            onClick={() => {
              setPreviewResponseId(preview ? null : response.id)
              setChosenVisualization(null)
            }}
            title={
              response.body.length > MAX_HTML_PREVIEW_LENGTH
                ? 'Preview is unavailable for very large HTML responses'
                : 'Render HTML in an isolated preview'
            }
          >
            <Play size={13} /> {preview ? 'Code' : 'Preview'}
          </button>
          <select
            className="response-visual-select"
            value={visualization ?? 'code'}
            onChange={(event) => {
              const mode = event.target.value
              setChosenVisualization(
                mode === 'code'
                  ? null
                  : {
                      responseId: response.id,
                      mode: mode as VisualizationMode
                    }
              )
              setPreviewResponseId(null)
            }}
            disabled={format !== 'JSON'}
            aria-label="Visualize JSON response"
            title="Display JSON records as a table or chart"
          >
            <option value="code">Code</option>
            <option value="table">Table</option>
            <option value="line">Line chart</option>
            <option value="bar">Bar chart</option>
          </select>
          {format === 'HTML' && preview && (
            <span className="response-preview-note">Isolated preview · no external requests</span>
          )}
          {(format === 'Hex' || format === 'Base64') && (
            <span className="response-preview-note">Encoded from decoded UTF-8 text</span>
          )}
        </div>
      )}
      {response.error ? (
        <div className="response-error">{response.error}</div>
      ) : (
        <>
          <ResponseBody
            key={`${response.id}:${format}`}
            prepared={formattedBody}
            hidden={tab !== 'body' || preview || Boolean(visualization)}
          />
          {tab === 'body' && preview && (
            <iframe
              className="response-html-preview"
              title="Rendered HTML response"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={sandboxedHtmlDocument(response.body)}
            />
          )}
          {tab === 'body' && visualization && (
            <ResponseVisualization
              key={`${response.id}:${visualization}`}
              body={response.body}
              mode={visualization}
            />
          )}
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
          {tab === 'cookies' && (
            <div className="response-cookies">
              {cookies.length ? (
                <div className="response-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Value</th>
                        <th>Domain</th>
                        <th>Path</th>
                        <th>Expires</th>
                        <th>SameSite</th>
                        <th>HttpOnly</th>
                        <th>Secure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cookies.map((cookie, index) => (
                        <tr key={`${cookie.name}-${index}`}>
                          <td>{cookie.name}</td>
                          <td>{cookie.value}</td>
                          <td>{cookie.domain || '—'}</td>
                          <td>{cookie.path || '—'}</td>
                          <td>{cookie.expires || '—'}</td>
                          <td>{cookie.sameSite || '—'}</td>
                          <td>{cookie.httpOnly ? 'Yes' : 'No'}</td>
                          <td>{cookie.secure ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No Set-Cookie headers in this response.</p>
              )}
            </div>
          )}
        </>
      )}
      {(response.contentType || formattedBody.isJson) && (
        <footer className="response-footer">
          <span className="response-content-type">
            <Braces size={13} /> {response.contentType || 'application/json'}
          </span>
          {format === 'JSON' && formattedBody.isJson && <JsonLegend />}
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
                <span className={responseTokenClass(prepared.format, token.kind)} key={index}>
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
        {prepared.format !== 'Raw' && prepared.format !== 'Hex' && prepared.format !== 'Base64'
          ? tokenizeResponseText(content, prepared.format)?.map((token, tokenIndex) => (
              <span className={responseTokenClass(prepared.format, token.kind)} key={tokenIndex}>
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
