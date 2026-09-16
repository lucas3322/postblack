import { describe, expect, it } from 'vitest'
import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  sidebarWidthPercentage
} from './sidebar-size'

describe('sidebar size', () => {
  it('keeps the sidebar inside usable limits', () => {
    expect(clampSidebarWidth(100)).toBe(MIN_SIDEBAR_WIDTH)
    expect(clampSidebarWidth(340.4)).toBe(340)
    expect(clampSidebarWidth(900)).toBe(MAX_SIDEBAR_WIDTH)
  })

  it('uses a stable default and accessible percentage', () => {
    expect(clampSidebarWidth(DEFAULT_SIDEBAR_WIDTH)).toBe(DEFAULT_SIDEBAR_WIDTH)
    expect(sidebarWidthPercentage(MIN_SIDEBAR_WIDTH)).toBe(0)
    expect(sidebarWidthPercentage(MAX_SIDEBAR_WIDTH)).toBe(100)
  })
})
