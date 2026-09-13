import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HTTP_METHODS, type HttpMethod } from '../../../shared/domain'

interface MethodSelectProps {
  value: HttpMethod
  onChange: (method: HttpMethod) => void
}

export function MethodSelect({ value, onChange }: MethodSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  const focusOption = (index: number): void => {
    optionRefs.current[(index + HTTP_METHODS.length) % HTTP_METHODS.length]?.focus()
  }

  const showMenu = (): void => {
    setOpen(true)
    window.requestAnimationFrame(() => focusOption(HTTP_METHODS.indexOf(value)))
  }

  const chooseMethod = (method: HttpMethod): void => {
    onChange(method)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      className={`method-select method-${value.toLowerCase()}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="method-trigger"
        aria-label={`HTTP method: ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : showMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            showMenu()
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      >
        {value}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="method-menu" role="listbox" aria-label="HTTP method">
          {HTTP_METHODS.map((method, index) => (
            <button
              key={method}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              type="button"
              role="option"
              aria-selected={method === value}
              className={`method-menu-option method-${method.toLowerCase()}${method === value ? ' selected' : ''}`}
              onClick={() => chooseMethod(method)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  focusOption(index + (event.key === 'ArrowDown' ? 1 : -1))
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault()
                  focusOption(event.key === 'Home' ? 0 : HTTP_METHODS.length - 1)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setOpen(false)
                  triggerRef.current?.focus()
                }
              }}
            >
              <span>{method}</span>
              {method === value && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
