import { useRef, type PointerEvent } from 'react'

interface RequestPaneSplitterProps {
  percentage: number
  onDrag: (clientY: number) => void
  onAdjust: (delta: number) => void
  onLimit: (edge: 'min' | 'max') => void
  onReset: () => void
}

export function RequestPaneSplitter({
  percentage,
  onDrag,
  onAdjust,
  onLimit,
  onReset
}: RequestPaneSplitterProps): React.JSX.Element {
  const dragging = useRef(false)

  const stopDragging = (event: PointerEvent<HTMLDivElement>): void => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className="request-pane-splitter"
      role="separator"
      aria-label="Resize request and response panes"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        onDrag(event.clientY)
      }}
      onPointerMove={(event) => {
        if (dragging.current) onDrag(event.clientY)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={() => {
        dragging.current = false
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          onAdjust(event.key === 'ArrowUp' ? -20 : 20)
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          onLimit(event.key === 'Home' ? 'min' : 'max')
        }
      }}
    >
      <span className="request-pane-splitter-grip" aria-hidden="true" />
    </div>
  )
}
