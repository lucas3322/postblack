interface VariableSuggestionsProps {
  names: string[]
  activeIndex: number
  onSelect: (name: string) => void
  onManageVariables?: () => void
}

export function VariableSuggestions({
  names,
  activeIndex,
  onSelect,
  onManageVariables
}: VariableSuggestionsProps): React.JSX.Element {
  return (
    <div className="variable-suggestions" role="listbox" aria-label="Available variables">
      {names.length ? (
        names.map((name, index) => (
          <button
            type="button"
            key={name}
            role="option"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? 'active' : ''}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(name)}
          >
            {`{{${name}}}`}
          </button>
        ))
      ) : (
        <span className="variable-suggestions-empty">No matching variables</span>
      )}
      {onManageVariables && (
        <button
          type="button"
          className="variable-suggestions-manage"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onManageVariables}
        >
          Manage variables…
        </button>
      )}
    </div>
  )
}
