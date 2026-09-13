import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { VariableDetail } from '../../../shared/variables'

interface VariableReferenceProps {
  name: string
  label: string
  detail?: VariableDetail
  onActivate?: () => void
}

export function VariableReference({
  name,
  label,
  detail,
  onActivate
}: VariableReferenceProps): React.JSX.Element {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    []
  )

  const cancelClose = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  const scheduleClose = (): void => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      setPosition(null)
      setRevealed(false)
      setCopied(false)
    }, 180)
  }

  const open = (element: HTMLElement): void => {
    cancelClose()
    const bounds = element.getBoundingClientRect()
    setPosition({
      top: Math.min(bounds.bottom + 7, window.innerHeight - 118),
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - 288))
    })
  }

  const copy = async (): Promise<void> => {
    if (!detail) return
    try {
      await navigator.clipboard.writeText(detail.value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span
      className={`variable-reference ${detail ? 'url-variable-known' : 'url-variable-missing'}`}
      onMouseEnter={(event) => open(event.currentTarget)}
      onMouseLeave={scheduleClose}
      onPointerDown={(event) => {
        if (!onActivate) return
        event.preventDefault()
        onActivate()
      }}
    >
      {label}
      {position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="variable-peek"
            style={{ top: position.top, left: position.left }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            role="status"
          >
            <div className="variable-peek-title">
              <strong>{`{{${name}}}`}</strong>
              <span>{detail?.scope ?? 'undefined'}</span>
            </div>
            {detail ? (
              <div className="variable-peek-value">
                <code>{detail.secret && !revealed ? '••••••••' : detail.value || '(empty)'}</code>
                {detail.secret && (
                  <button
                    type="button"
                    onClick={() => setRevealed((current) => !current)}
                    aria-label={revealed ? 'Hide variable value' : 'Show variable value'}
                    title={revealed ? 'Hide value' : 'Show value'}
                  >
                    {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void copy()}
                  aria-label="Copy variable value"
                  title="Copy value"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ) : (
              <p>Variable not found in the active environment, workspace or globals.</p>
            )}
          </div>,
          document.body
        )}
    </span>
  )
}
