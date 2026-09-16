import { useRef, type PointerEvent } from 'react'

interface SidebarSplitterProps {
  percentage: number
  onDrag: (clientX: number) => void
  onAdjust: (delta: number) => void
  onLimit: (edge: 'min' | 'max') => void
  onReset: () => void
}

export function SidebarSplitter({
  percentage,
  onDrag,
  onAdjust,
  onLimit,
  onReset
}: SidebarSplitterProps): React.JSX.Element {
  const dragging = useRef(false)

  const stopDragging = (event: PointerEvent<HTMLDivElement>): void => {
    dragging.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className="sidebar-splitter"
      role="separator"
      aria-label="Resize collections sidebar"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      tabIndex={0}
      title="Drag to resize sidebar · double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
        onDrag(event.clientX)
      }}
      onPointerMove={(event) => {
        if (dragging.current) onDrag(event.clientX)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={() => {
        dragging.current = false
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          onAdjust(event.key === 'ArrowLeft' ? -16 : 16)
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault()
          onLimit(event.key === 'Home' ? 'min' : 'max')
        }
      }}
    >
      <span aria-hidden="true" />
    </div>
  )
}
