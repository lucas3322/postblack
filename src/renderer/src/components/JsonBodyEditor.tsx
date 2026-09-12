import { useMemo, useRef } from 'react'
import { tokenizeJson } from '../lib/json-highlighter'

const MAX_HIGHLIGHTED_LENGTH = 20_000

interface JsonBodyEditorProps {
  value: string
  onChange: (value: string) => void
}

export function JsonBodyEditor({ value, onChange }: JsonBodyEditorProps): React.JSX.Element {
  const highlightRef = useRef<HTMLPreElement>(null)
  const highlighted = value.length <= MAX_HIGHLIGHTED_LENGTH
  const tokens = useMemo(() => (highlighted ? tokenizeJson(value) : []), [highlighted, value])

  const syncScroll = (textarea: HTMLTextAreaElement): void => {
    if (!highlightRef.current) return
    highlightRef.current.scrollTop = textarea.scrollTop
    highlightRef.current.scrollLeft = textarea.scrollLeft
  }

  return (
    <div className="json-body-editor">
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
        className={`code body-textarea ${highlighted ? 'json-body-input' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => syncScroll(event.currentTarget)}
        placeholder={'{\n  "name": "Postblack"\n}'}
        aria-label="JSON request body"
        spellCheck={false}
      />
      {!highlighted && (
        <span className="json-body-size-hint">
          Highlighting paused for a large body to keep editing fast.
        </span>
      )}
    </div>
  )
}
