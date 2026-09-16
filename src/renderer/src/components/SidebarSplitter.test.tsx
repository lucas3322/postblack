import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SidebarSplitter } from './SidebarSplitter'

describe('SidebarSplitter', () => {
  it('renders an accessible vertical resize control', () => {
    const html = renderToString(
      <SidebarSplitter
        percentage={42}
        onDrag={() => undefined}
        onAdjust={() => undefined}
        onLimit={() => undefined}
        onReset={() => undefined}
      />
    )

    expect(html).toContain('role="separator"')
    expect(html).toContain('aria-orientation="vertical"')
    expect(html).toContain('aria-valuenow="42"')
    expect(html).toContain('double-click to reset')
  })
})
