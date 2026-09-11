import { describe, expect, it } from 'vitest'
import { createKeyValue, createWorkspace } from './domain'
import { findUnresolvedVariables, resolveVariables, scopedVariables } from './variables'

describe('variables', () => {
  it('resolves known values while preserving unresolved placeholders', () => {
    const result = resolveVariables('{{base_url}}/users/{{id}}', { base_url: 'https://api.example.com' })
    expect(result).toBe('https://api.example.com/users/{{id}}')
    expect(findUnresolvedVariables(result)).toEqual(['id'])
  })

  it('applies global, workspace, and environment precedence', () => {
    const workspace = createWorkspace()
    workspace.variables = [createKeyValue('base_url', 'https://production.example.com')]
    workspace.environments[0]!.variables = [createKeyValue('base_url', 'http://localhost:3000')]
    workspace.activeEnvironmentId = workspace.environments[0]!.id

    const globals = [
      createKeyValue('base_url', 'https://global.example.com'),
      createKeyValue('organization', 'postblack')
    ]

    expect(scopedVariables(globals, workspace)).toMatchObject({
      base_url: 'http://localhost:3000',
      organization: 'postblack'
    })
  })
})
