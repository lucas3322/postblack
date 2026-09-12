import { describe, expect, it } from 'vitest'
import { availablePaneHeight, clampRequestPaneHeight, requestPaneBounds } from './request-pane-size'

describe('request pane sizing', () => {
  it('subtracts the splitter and optional tab bar from available height', () => {
    expect(availablePaneHeight(800, false)).toBe(794)
    expect(availablePaneHeight(800, true)).toBe(757)
  })

  it('keeps both panes visible while dragging', () => {
    const available = availablePaneHeight(800, true)
    expect(clampRequestPaneHeight(available, -100)).toBe(220)
    expect(clampRequestPaneHeight(available, 1000)).toBe(available - 150)
  })

  it('adapts bounds when the window is short', () => {
    const bounds = requestPaneBounds(300)
    expect(bounds.min).toBeLessThanOrEqual(bounds.max)
    expect(bounds.max).toBeLessThan(300)
  })
})
