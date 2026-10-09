import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { HttpMethod } from '../../../shared/domain'
import { searchCommands } from '../lib/command-search'

export interface PaletteCommand {
  id: string
  group: 'Requests' | 'Actions' | 'Collections' | 'Workspaces'
  title: string
  subtitle?: string
  keywords?: string
  method?: HttpMethod
  icon?: ReactNode
  shortcut?: string
  run: () => void
}

interface CommandPaletteProps {
  commands: PaletteCommand[]
  onClose: () => void
}

const GROUP_ORDER: PaletteCommand['group'][] = ['Actions', 'Requests', 'Collections', 'Workspaces']

export function CommandPalette({ commands, onClose }: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const matches = searchCommands(commands, query)
    // Without a query, show a calm grouped list; with one, trust the ranking.
    return query.trim()
      ? matches
      : GROUP_ORDER.flatMap((group) => matches.filter((command) => command.group === group))
  }, [commands, query])

  useEffect(() => setActiveIndex(0), [query])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const run = (command: PaletteCommand | undefined): void => {
    if (!command) return
    onClose()
    command.run()
  }

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="palette-search">
          <Search size={17} />
          <input
            autoFocus
            value={query}
            placeholder="Search requests, collections and actions…"
            aria-label="Search commands"
            aria-controls="palette-results"
            aria-activedescendant={results[activeIndex] ? `palette-${results[activeIndex].id}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((current) => Math.min(current + 1, results.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((current) => Math.max(current - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                run(results[activeIndex])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
          />
          <kbd>esc</kbd>
        </label>
        <div className="palette-results" id="palette-results" role="listbox" ref={listRef}>
          {results.length === 0 && <p className="palette-empty">No results for “{query.trim()}”.</p>}
          {results.map((command, index) => {
            const showGroup = !query.trim() && command.group !== results[index - 1]?.group
            return (
              <div key={command.id}>
                {showGroup && <div className="palette-group">{command.group}</div>}
                <button
                  id={`palette-${command.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`palette-item${index === activeIndex ? ' active' : ''}`}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => run(command)}
                >
                  <span className="palette-item-icon">
                    {command.method ? (
                      <span className={`method-badge method-${command.method.toLowerCase()}`}>
                        {command.method === 'DELETE'
                          ? 'DEL'
                          : command.method === 'OPTIONS'
                            ? 'OPT'
                            : command.method}
                      </span>
                    ) : (
                      command.icon
                    )}
                  </span>
                  <span className="palette-item-text">
                    <strong>{command.title}</strong>
                    {command.subtitle && <small>{command.subtitle}</small>}
                  </span>
                  {command.shortcut ? (
                    <kbd>{command.shortcut}</kbd>
                  ) : (
                    index === activeIndex && <CornerDownLeft size={14} className="palette-enter" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
        <footer className="palette-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span className="palette-footer-spacer" />
          <span>{results.length} results</span>
        </footer>
      </section>
    </div>
  )
}
