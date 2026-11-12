import { Check, Copy, Eye, EyeOff, Pencil, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { portalHost } from '../lib/portal-host'
import type { VariableDetail } from '../../../shared/variables'

interface VariableReferenceProps {
  name: string
  label: string
  detail?: VariableDetail
}

export function VariableReference({ name, label, detail }: VariableReferenceProps): React.JSX.Element {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const referenceRef = useRef<HTMLSpanElement>(null)

  // The input owns all pointer selection. Detect hover without placing a hit target
  // over its text, which otherwise steals clicks and drag selection on Windows.
  useEffect(() => {
    const reference = referenceRef.current
    const surface = reference?.closest(
      '.json-body-surface, .url-editor, .variable-value-editor, .auth-value-input'
    )
    if (!reference || !surface) return
    let inside = false
    const move = (event: Event): void => {
      const pointer = event as PointerEvent
      const range = document.createRange()
      range.selectNodeContents(reference)
      const hit = [...range.getClientRects()].some(
        (rect) =>
          pointer.clientX >= rect.left &&
          pointer.clientX <= rect.right &&
          pointer.clientY >= rect.top &&
          pointer.clientY <= rect.bottom
      )
      if (hit) open(reference)
      else if (inside) scheduleClose()
      inside = hit
    }
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerleave', scheduleClose)
    return () => {
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', scheduleClose)
    }
  }, [editing])

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
    if (editing) return
    closeTimer.current = setTimeout(() => {
      setPosition(null)
      setRevealed(false)
      setCopied(false)
    }, 350)
  }

  const open = (element: HTMLElement): void => {
    cancelClose()
    const bounds = element.getBoundingClientRect()
    setPosition({
      top: Math.max(8, Math.min(bounds.bottom + 7, window.innerHeight - 210)),
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
      ref={referenceRef}
      className={`variable-reference ${detail ? 'url-variable-known' : 'url-variable-missing'}`}
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
            role="dialog"
            aria-label={`Variable ${name}`}
            onFocusCapture={cancelClose}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) scheduleClose()
            }}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Escape') {
                setEditing(false)
                setPosition(null)
              }
            }}
          >
            <div className="variable-peek-title">
              <strong>{`{{${name}}}`}</strong>
              <span>{detail?.scope ?? 'undefined'}</span>
            </div>
            {detail?.onSave && !editing && (
              <button
                type="button"
                className="text-button variable-edit-button"
                onClick={() => {
                  cancelClose()
                  setDraft(detail.value)
                  setError('')
                  setEditing(true)
                }}
              >
                <Pencil size={13} /> Edit value
              </button>
            )}
            {editing && detail?.onSave && (
              <form
                className="variable-peek-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  setSaving(true)
                  setError('')
                  void detail.onSave!(draft)
                    .then(() => {
                      setEditing(false)
                      setPosition(null)
                    })
                    .catch((reason) =>
                      setError(reason instanceof Error ? reason.message : 'Could not save variable.')
                    )
                    .finally(() => setSaving(false))
                }}
              >
                <input
                  autoFocus
                  aria-label="Variable value"
                  type={detail.secret && !revealed ? 'password' : 'text'}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={saving}
                />
                <div className="variable-peek-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={saving}
                    onClick={() => setEditing(false)}
                  >
                    <X size={13} /> Cancel
                  </button>
                  <button type="submit" className="button primary" disabled={saving}>
                    <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {error && <p role="alert">{error}</p>}
              </form>
            )}
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
          portalHost()
        )}
    </span>
  )
}
