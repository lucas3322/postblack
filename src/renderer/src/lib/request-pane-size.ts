export const REQUEST_SPLITTER_HEIGHT = 6
export const REQUEST_TAB_BAR_HEIGHT = 37
export const DEFAULT_REQUEST_PANE_RATIO = 0.46

export function availablePaneHeight(containerHeight: number, hasTabs: boolean): number {
  return Math.max(0, containerHeight - REQUEST_SPLITTER_HEIGHT - (hasTabs ? REQUEST_TAB_BAR_HEIGHT : 0))
}

export function requestPaneBounds(availableHeight: number): { min: number; max: number } {
  const min = Math.min(220, Math.floor(availableHeight * 0.58))
  const minResponse = Math.min(150, Math.floor(availableHeight * 0.42))
  return { min, max: Math.max(min, availableHeight - minResponse) }
}

export function clampRequestPaneHeight(availableHeight: number, desiredHeight: number): number {
  const { min, max } = requestPaneBounds(availableHeight)
  return Math.min(max, Math.max(min, desiredHeight))
}
