import { useRef } from 'react'
import { splitVariableReferences, type VariableDetail } from '../../../shared/variables'
import { VariableReference } from './VariableReference'

interface AuthValueInputProps {
  id?: string
  value: string
  placeholder?: string
  secret?: boolean
  showRaw?: boolean
  variableDetails: Record<string, VariableDetail>
  onChange: (value: string) => void
}

export function AuthValueInput({
  id,
  value,
  placeholder,
  secret = false,
  showRaw = false,
  variableDetails,
  onChange
}: AuthValueInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const segments = splitVariableReferences(value)
  const completeReference = segments.length === 1 && segments[0].kind === 'variable'
  const showReference = segments.some((segment) => segment.kind === 'variable') && (!secret || completeReference)

  return (
    <div className="auth-value-input">
      {showReference && (
        <div ref={highlightRef} className="auth-value-highlight" aria-hidden="true">
          {segments.map((segment, index) =>
            segment.kind === 'variable' ? (
              <VariableReference
                key={index}
                name={segment.name}
                label={segment.value}
                detail={variableDetails[segment.name]}
                onActivate={() => {
                  const caret = segments.slice(0, index + 1).reduce((sum, part) => sum + part.value.length, 0)
                  inputRef.current?.focus()
                  inputRef.current?.setSelectionRange(caret, caret)
                }}
              />
            ) : segment.value
          )}
        </div>
      )}
      <input
        id={id}
        ref={inputRef}
        className={showReference ? 'auth-variable-input' : undefined}
        type={secret && !showRaw && !completeReference ? 'password' : 'text'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (highlightRef.current) highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
