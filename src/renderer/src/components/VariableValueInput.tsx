import { useRef } from 'react'
import { splitVariableReferences, type VariableDetail } from '../../../shared/variables'
import { useVariableAutocomplete } from './useVariableAutocomplete'
import { VariableSuggestions } from './VariableSuggestions'
import { VariableReference } from './VariableReference'

interface VariableValueInputProps {
  value: string
  placeholder: string
  variableNames: string[]
  variableDetails?: Record<string, VariableDetail>
  onChange: (value: string) => void
  onOpenVariables?: () => void
}

export function VariableValueInput({
  value,
  placeholder,
  variableNames,
  variableDetails = {},
  onChange,
  onOpenVariables
}: VariableValueInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const autocomplete = useVariableAutocomplete({ value, variableNames, inputRef, onChange })
  const segments = splitVariableReferences(value)

  return (
    <div className="secret-input variable-value-editor">
      <div ref={highlightRef} className="variable-value-highlight" aria-hidden="true">
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
        className="variable-value-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          autocomplete.updateQuery(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length
          )
        }}
        onClick={() => autocomplete.updateQuery(value, inputRef.current?.selectionStart ?? value.length)}
        onKeyDown={(event) => autocomplete.handleKeyDown(event)}
        onBlur={autocomplete.close}
        onScroll={(event) => {
          if (highlightRef.current) highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
        }}
        placeholder={placeholder}
        spellCheck={false}
      />
      {autocomplete.query && (
        <VariableSuggestions
          names={autocomplete.matches}
          activeIndex={autocomplete.activeIndex}
          onSelect={autocomplete.select}
          onManageVariables={
            onOpenVariables
              ? () => {
                  autocomplete.close()
                  onOpenVariables()
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
