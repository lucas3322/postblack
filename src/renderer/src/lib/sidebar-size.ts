export const DEFAULT_SIDEBAR_WIDTH = 260
export const MIN_SIDEBAR_WIDTH = 210
export const MAX_SIDEBAR_WIDTH = 480
export const SIDEBAR_SPLITTER_WIDTH = 6

export function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)))
}

export function sidebarWidthPercentage(width: number): number {
  return Math.round(
    ((clampSidebarWidth(width) - MIN_SIDEBAR_WIDTH) / (MAX_SIDEBAR_WIDTH - MIN_SIDEBAR_WIDTH)) * 100
  )
}
