import { useMemo, useRef, useState } from 'react'
import { formatRequestJson } from '../lib/format-request-json'
import { tokenizeJson } from '../lib/json-highlighter'

const MAX_HIGHLIGHTED_LENGTH = 20_000

interface JsonBodyEditorProps {
  value: string
  onChange: (value: string) => void
}

export function JsonBodyEditor({ value, onChange }: JsonBodyEditorProps): React.JSX.Element {
  const highlightRef = useRef<HTMLPreElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [formatError, setFormatError] = useState<string | null>(null)
  const highlighted = value.length <= MAX_HIGHLIGHTED_LENGTH
  const tokens = useMemo(() => (highlighted ? tokenizeJson(value) : []), [highlighted, value])

  const syncScroll = (textarea: HTMLTextAreaElement): void => {
    if (!highlightRef.current) return
    highlightRef.current.scrollTop = textarea.scrollTop
    highlightRef.current.scrollLeft = textarea.scrollLeft
  }

  const beautify = (): void => {
    const result = formatRequestJson(value)
    if (!result.ok) {
      setFormatError(result.message)
      textareaRef.current?.focus()
      return
    }

    setFormatError(null)
    if (result.value !== value) onChange(result.value)
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(0, 0)
      textareaRef.current.scrollTop = 0
      textareaRef.current.scrollLeft = 0
      syncScroll(textareaRef.current)
    }
  }

  return (
    <div className="json-body-editor">
      <div className="json-body-surface">
        {highlighted && (
          <pre ref={highlightRef} className="json-body-highlight code" aria-hidden="true">
            <code>
              {tokens.map((token, index) => (
                <span className={`json-${token.kind}`} key={index}>
                  {token.value}
                </span>
              ))}
              {value.endsWith('\n') && '\u200b'}
            </code>
          </pre>
        )}
        <textarea
          ref={textareaRef}
          className={`code body-textarea ${highlighted ? 'json-body-input' : ''}`}
          value={value}
          onChange={(event) => {
            setFormatError(null)
            onChange(event.target.value)
          }}
          onScroll={(event) => syncScroll(event.currentTarget)}
          placeholder={'{\n  "name": "Postblack"\n}'}
          aria-label="JSON request body"
          spellCheck={false}
        />
      </div>
      <div className="json-body-toolbar">
        {formatError ? (
          <span className="json-format-error" role="alert" title={formatError}>
            {formatError}
          </span>
        ) : !highlighted ? (
          <span>Highlighting paused for a large body to keep editing fast.</span>
        ) : null}
        <button
          type="button"
          onClick={beautify}
          disabled={!value.trim()}
          title="Format JSON with two-space indentation"
        >
          Beautify
        </button>
      </div>
    </div>
  )
}
