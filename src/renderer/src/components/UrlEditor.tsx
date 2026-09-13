import { ChevronDown, Variable } from 'lucide-react'
import { useRef } from 'react'
import { splitVariableReferences, type VariableDetail } from '../../../shared/variables'
import { insertVariableAtSelection } from '../lib/url-variable-editor'
import { useVariableAutocomplete } from './useVariableAutocomplete'
import { VariableSuggestions } from './VariableSuggestions'
import { VariableReference } from './VariableReference'

const MANAGE_VARIABLES = '__postblack_manage_variables__'

interface UrlEditorProps {
  value: string
  variableNames: string[]
  variableDetails?: Record<string, VariableDetail>
  importingCurl: boolean
  sending: boolean
  onChange: (value: string) => void
  onPaste: React.ClipboardEventHandler<HTMLInputElement>
  onSend: () => void
  onOpenVariables: () => void
}

export function UrlEditor({
  value,
  variableNames,
  variableDetails = {},
  importingCurl,
  sending,
  onChange,
  onPaste,
  onSend,
  onOpenVariables
}: UrlEditorProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const autocomplete = useVariableAutocomplete({
    value,
    variableNames,
    inputRef,
    onChange,
    onInserted: (caret) => {
      selectionRef.current = { start: caret, end: caret }
    }
  })
  const segments = splitVariableReferences(value)
  const missing = segments
    .filter((segment) => segment.kind === 'variable' && !variableNames.includes(segment.name))
    .map((segment) => (segment.kind === 'variable' ? segment.name : ''))

  const rememberSelection = (): void => {
    const input = inputRef.current
    if (!input) return
    selectionRef.current = {
      start: input.selectionStart ?? value.length,
      end: input.selectionEnd ?? value.length
    }
  }

  const insertVariable = (name: string): void => {
    autocomplete.close()
    const input = inputRef.current
    const selection = selectionRef.current ?? { start: value.length, end: value.length }
    const result = insertVariableAtSelection(value, name, selection.start, selection.end)
    onChange(result.value)
    selectionRef.current = { start: result.caret, end: result.caret }
    window.requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(result.caret, result.caret)
    })
  }

  return (
    <>
      <div className="url-editor">
        <div ref={highlightRef} className="url-highlight code" aria-hidden="true">
          {segments.map((segment, index) =>
            segment.kind === 'variable' ? (
              <VariableReference
                name={segment.name}
                label={segment.value}
                detail={variableDetails[segment.name]}
                key={index}
                onActivate={() => {
                  const caret = segments.slice(0, index + 1).reduce((sum, part) => sum + part.value.length, 0)
                  inputRef.current?.focus()
                  inputRef.current?.setSelectionRange(caret, caret)
                }}
              />
            ) : (
              <span key={index}>{segment.value}</span>
            )
          )}
        </div>
        <input
          ref={inputRef}
          className="url-input code"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            autocomplete.updateQuery(
              event.target.value,
              event.target.selectionStart ?? event.target.value.length
            )
          }}
          onPaste={(event) => {
            autocomplete.close()
            onPaste(event)
          }}
          onClick={() => {
            rememberSelection()
            autocomplete.updateQuery(value, inputRef.current?.selectionStart ?? value.length)
          }}
          onKeyUp={rememberSelection}
          onSelect={rememberSelection}
          onScroll={(event) => {
            if (highlightRef.current) highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
          }}
          onKeyDown={(event) => {
            if (autocomplete.handleKeyDown(event)) return
            if (event.key === 'Enter' && !sending) onSend()
          }}
          onBlur={autocomplete.close}
          placeholder={importingCurl ? 'Importing cURL…' : 'Paste a URL or complete cURL command'}
          title={missing.length ? `Undefined variable: ${[...new Set(missing)].join(', ')}` : undefined}
          disabled={importingCurl}
          spellCheck={false}
        />
        {autocomplete.query && (
          <VariableSuggestions
            names={autocomplete.matches}
            activeIndex={autocomplete.activeIndex}
            onSelect={autocomplete.select}
            onManageVariables={() => {
              autocomplete.close()
              onOpenVariables()
            }}
          />
        )}
      </div>
      <div className="url-variable-picker">
        <Variable size={13} aria-hidden="true" />
        <select
          aria-label="Insert variable in URL"
          title="Insert an existing variable at the cursor"
          value=""
          onChange={(event) => {
            if (event.target.value === MANAGE_VARIABLES) onOpenVariables()
            else insertVariable(event.target.value)
          }}
        >
          <option value="" disabled>
            Variables
          </option>
          {variableNames.map((name) => (
            <option key={name} value={name}>{`{{${name}}}`}</option>
          ))}
          <option value={MANAGE_VARIABLES}>Manage variables…</option>
        </select>
        <ChevronDown size={12} aria-hidden="true" />
      </div>
    </>
  )
}
