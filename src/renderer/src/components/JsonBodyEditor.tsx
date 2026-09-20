import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { splitVariableReferences, type VariableDetail } from '../../../shared/variables'
import { findTextMatches, moveTextMatch, revealTextMatch } from '../lib/body-search'
import { formatRequestJson } from '../lib/format-request-json'
import { tokenizeJson } from '../lib/json-highlighter'
import { VariableReference } from './VariableReference'

const MAX_HIGHLIGHTED_LENGTH = 20_000

interface JsonBodyEditorProps {
  value: string
  onChange: (value: string) => void
  variableDetails?: Record<string, VariableDetail>
  syntax?: 'json' | 'plain'
  placeholder?: string
  ariaLabel?: string
}

export function JsonBodyEditor({
  value,
  onChange,
  variableDetails = {},
  syntax = 'json',
  placeholder,
  ariaLabel
}: JsonBodyEditorProps): React.JSX.Element {
  const highlightRef = useRef<HTMLPreElement>(null)
  const searchHighlightRef = useRef<HTMLPreElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [formatError, setFormatError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [activeMatch, setActiveMatch] = useState(0)
  const highlighted = value.length <= MAX_HIGHLIGHTED_LENGTH
  const tokens = useMemo(
    () =>
      highlighted ? (syntax === 'json' ? tokenizeJson(value) : [{ kind: 'plain' as const, value }]) : [],
    [highlighted, syntax, value]
  )
  const matches = useMemo(
    () => (searchOpen ? findTextMatches(value, searchQuery, matchCase) : []),
    [searchOpen, matchCase, searchQuery, value]
  )
  const displayedActiveMatch = matches.length ? Math.min(activeMatch, matches.length - 1) : 0
  const currentMatch = matches[displayedActiveMatch]

  const syncScroll = (textarea: HTMLTextAreaElement): void => {
    for (const layer of [highlightRef.current, searchHighlightRef.current]) {
      if (!layer) continue
      layer.scrollTop = textarea.scrollTop
      layer.scrollLeft = textarea.scrollLeft
    }
    if (searchHighlightRef.current) {
      searchHighlightRef.current.style.width = `${textarea.clientWidth}px`
    }
  }

  const revealActiveMatch = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const match = matches[displayedActiveMatch]
    if (match) revealTextMatch(textarea, match)
    else textarea.setSelectionRange(textarea.selectionStart, textarea.selectionStart)
    syncScroll(textarea)
  }, [matches, displayedActiveMatch])

  useEffect(() => {
    // Editing with the find bar open must never move the user's caret.
    const textarea = textareaRef.current
    if (!searchOpen || textarea?.ownerDocument.activeElement === textarea) return
    revealActiveMatch()
  }, [searchOpen, revealActiveMatch])

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

  const openSearch = (): void => {
    setSearchOpen(true)
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }

  const closeSearch = (): void => {
    setSearchOpen(false)
    textareaRef.current?.focus()
  }

  const updateSearch = (query: string): void => {
    setSearchQuery(query)
    setActiveMatch(0)
  }

  const moveSearch = (direction: 1 | -1): void => {
    const next = moveTextMatch(displayedActiveMatch, matches.length, direction)
    setActiveMatch(next)
    searchInputRef.current?.focus()
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      event.stopPropagation()
      openSearch()
      return
    }
    if (searchOpen && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeSearch()
    }
  }

  return (
    <div className="json-body-editor" onKeyDownCapture={handleEditorKeyDown}>
      <div className="json-body-surface">
        {searchOpen && (
          <div className="body-find" role="search" aria-label="Localizar no body">
            <Search size={14} />
            <input
              ref={searchInputRef}
              value={searchQuery}
              placeholder="Localizar"
              aria-label="Texto para localizar no body"
              onFocus={revealActiveMatch}
              onChange={(event) => updateSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                event.stopPropagation()
                moveSearch(event.shiftKey ? -1 : 1)
              }}
            />
            <span className="body-find-count" aria-live="polite">
              {searchQuery
                ? matches.length
                  ? `${displayedActiveMatch + 1}/${matches.length}${matches.length === 10_000 ? '+' : ''}`
                  : 'Nenhum resultado'
                : '0/0'}
            </span>
            <button
              type="button"
              className={matchCase ? 'active' : ''}
              aria-label="Diferenciar maiúsculas e minúsculas"
              aria-pressed={matchCase}
              title="Diferenciar maiúsculas e minúsculas"
              onClick={() => {
                const nextMatchCase = !matchCase
                setMatchCase(nextMatchCase)
                setActiveMatch(0)
                searchInputRef.current?.focus()
              }}
            >
              Aa
            </button>
            <button
              type="button"
              aria-label="Resultado anterior"
              title="Resultado anterior (Shift+Enter)"
              disabled={!matches.length}
              onClick={() => moveSearch(-1)}
            >
              <ChevronUp size={15} />
            </button>
            <button
              type="button"
              aria-label="Próximo resultado"
              title="Próximo resultado (Enter)"
              disabled={!matches.length}
              onClick={() => moveSearch(1)}
            >
              <ChevronDown size={15} />
            </button>
            <button type="button" aria-label="Fechar busca" title="Fechar (Esc)" onClick={closeSearch}>
              <X size={15} />
            </button>
          </div>
        )}
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
                          const tokenOffset = tokens
                            .slice(0, tokenIndex)
                            .reduce((sum, item) => sum + item.value.length, 0)
                          const segmentOffset = splitVariableReferences(token.value)
                            .slice(0, segmentIndex + 1)
                            .reduce((sum, item) => sum + item.value.length, 0)
                          const caret = tokenOffset + segmentOffset
                          textareaRef.current?.focus()
                          textareaRef.current?.setSelectionRange(caret, caret)
                        }}
                      />
                    ) : (
                      segment.value
                    )
                  )}
                </span>
              ))}
              {value.endsWith('\n') && '\u200b'}
            </code>
          </pre>
        )}
        {searchOpen && currentMatch && (
          <pre ref={searchHighlightRef} className="body-search-highlight code" aria-hidden="true">
            {value.slice(0, currentMatch.start)}
            <mark>{value.slice(currentMatch.start, currentMatch.end)}</mark>
            {value.slice(currentMatch.end)}
            {value.endsWith('\n') && '\u200b'}
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
          title="Ctrl/⌘+F para localizar no body"
          placeholder={placeholder ?? (syntax === 'json' ? '{\n  "name": "Postblack"\n}' : 'Request body')}
          aria-label={ariaLabel ?? (syntax === 'json' ? 'JSON request body' : 'Request body')}
          spellCheck={false}
        />
      </div>
      {syntax === 'json' && (
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
      )}
    </div>
  )
}
