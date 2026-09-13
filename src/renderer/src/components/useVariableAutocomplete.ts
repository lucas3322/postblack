import { useState, type RefObject } from 'react'
import {
  completeVariableQuery,
  findVariableQuery,
  variableMatches,
  type VariableQuery
} from '../lib/variable-autocomplete'

interface AutocompleteOptions {
  value: string
  variableNames: string[]
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (value: string) => void
  onInserted?: (caret: number) => void
}

export function useVariableAutocomplete({
  value,
  variableNames,
  inputRef,
  onChange,
  onInserted
}: AutocompleteOptions): {
  query: VariableQuery | null
  matches: string[]
  activeIndex: number
  updateQuery: (nextValue: string, caret: number) => void
  close: () => void
  select: (name: string) => void
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => boolean
} {
  const [query, setQuery] = useState<VariableQuery | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const matches = query ? variableMatches(variableNames, query.search) : []

  const updateQuery = (nextValue: string, caret: number): void => {
    setQuery(findVariableQuery(nextValue, caret))
    setActiveIndex(0)
  }

  const close = (): void => setQuery(null)

  const select = (name: string): void => {
    if (!query) return
    const result = completeVariableQuery(value, query, name)
    onChange(result.value)
    setQuery(null)
    onInserted?.(result.caret)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(result.caret, result.caret)
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): boolean => {
    if (!query) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return true
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (matches.length) {
        setActiveIndex(
          (current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length
        )
      }
      return true
    }
    if (event.key === 'Enter' || (event.key === 'Tab' && matches.length > 0)) {
      event.preventDefault()
      if (matches.length) select(matches[activeIndex] ?? matches[0])
      else close()
      return true
    }
    return false
  }

  return { query, matches, activeIndex, updateQuery, close, select, handleKeyDown }
}
