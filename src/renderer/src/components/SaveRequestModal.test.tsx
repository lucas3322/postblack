import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createRequest, createWorkspace } from '../../../shared/domain'
import { SaveRequestModal } from './SaveRequestModal'

describe('SaveRequestModal', () => {
  it('offers collections and folders as destinations for an unsaved request', () => {
    const workspace = createWorkspace('Workspace')
    workspace.collections[0].folders.push({
      id: 'folder-1',
      name: 'Authentication',
      requests: [],
      createdAt: '2026-01-01T00:00:00.000Z'
    })

    const html = renderToString(
      <SaveRequestModal
        request={createRequest()}
        workspace={workspace}
        onSave={() => undefined}
        onClose={() => undefined}
      />
    )

    expect(html).toContain('Getting started')
    expect(html).toContain('Getting started / Authentication')
    expect(html).toContain('Keep unsaved')
  })
})
