import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createWorkspace } from '../../../shared/domain'
import { IdeSettingsModal } from './IdeSettingsModal'

describe('IdeSettingsModal', () => {
  it('renders the Portuguese settings navigation and workspace overview', () => {
    const html = renderToString(
      <IdeSettingsModal
        preferences={{
          theme: 'dark',
          colorVision: 'normal',
          density: 'comfortable',
          fontSize: 'medium',
          reduceMotion: false
        }}
        workspaces={[createWorkspace('Workspace local')]}
        activeWorkspaceId={null}
        onPreview={() => undefined}
        onSave={() => undefined}
        onActivateWorkspace={() => undefined}
        onExportWorkspace={() => undefined}
        onImportWorkspace={() => undefined}
        onExportAllData={() => undefined}
        onClose={() => undefined}
      />
    )

    expect(html).toContain('Configurações do Postblack')
    expect(html).toContain('Aparência')
    expect(html).toContain('Acessibilidade')
    expect(html).toContain('Workspaces')
    expect(html).toContain('Dados')
  })
})
