import { useMemo, useRef, useState } from 'react'
import { splitVariableReferences, type VariableDetail } from '../../../shared/variables'
import { formatRequestJson } from '../lib/format-request-json'
import { tokenizeJson } from '../lib/json-highlighter'
import { VariableReference } from './VariableReference'

const MAX_HIGHLIGHTED_LENGTH = 20_000

interface JsonBodyEditorProps {
  value: string
  onChange: (value: string) => void
  variableDetails?: Record<string, VariableDetail>
  syntax?: 'json' | 'plain'
}

export function JsonBodyEditor({
  value,
  onChange,
  variableDetails = {},
  syntax = 'json'
}: JsonBodyEditorProps): React.JSX.Element {
  const highlightRef = useRef<HTMLPreElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [formatError, setFormatError] = useState<string | null>(null)
  const highlighted = value.length <= MAX_HIGHLIGHTED_LENGTH
  const tokens = useMemo(() => (
    highlighted ? syntax === 'json' ? tokenizeJson(value) : [{ kind: 'plain' as const, value }] : []
  ), [highlighted, syntax, value])

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
              {tokens.map((token, tokenIndex) => (
                <span className={`json-${token.kind}`} key={tokenIndex}>
                  {splitVariableReferences(token.value).map((segment, segmentIndex) =>
                    segment.kind === 'variable' ? (
                      <VariableReference
                        key={segmentIndex}
                        name={segment.name}
                        label={segment.value}
                        detail={variableDetails[segment.name]}
                        onActivate={() => {
                          const tokenOffset = tokens.slice(0, tokenIndex).reduce((sum, item) => sum + item.value.length, 0)
                          const segmentOffset = splitVariableReferences(token.value)
                            .slice(0, segmentIndex + 1)
                            .reduce((sum, item) => sum + item.value.length, 0)
                          const caret = tokenOffset + segmentOffset
                          textareaRef.current?.focus()
                          textareaRef.current?.setSelectionRange(caret, caret)
                        }}
                      />
                    ) : segment.value
                  )}
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
          placeholder={syntax === 'json' ? '{\n  "name": "Postblack"\n}' : 'Request body'}
          aria-label={syntax === 'json' ? 'JSON request body' : 'Request body'}
          spellCheck={false}
        />
      </div>
      {syntax === 'json' && <div className="json-body-toolbar">
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
      </div>}
    </div>
  )
}
