import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createRequest } from '../../../shared/domain'
import { RequestTabBar } from './RequestTabBar'

describe('RequestTabBar', () => {
  it('shows the new request action beside open tabs', () => {
    const request = createRequest('Health check')
    const html = renderToString(
      <RequestTabBar
        tabs={[{ workspaceId: 'workspace-1', requestId: request.id, pinned: true }]}
        requests={{ [request.id]: request }}
        selectedRequestId={request.id}
        dirtyRequestIds={new Set()}
        onSelect={() => undefined}
        onPin={() => undefined}
        onClose={() => undefined}
        onNew={() => undefined}
      />
    )

    expect(html).toContain('aria-label="New request"')
    expect(html).toContain('New request (Ctrl/⌘+N)')
  })
})
