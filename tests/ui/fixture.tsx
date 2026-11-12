import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '../../src/renderer/src/App'
import { createInitialState, createKeyValue } from '../../src/shared/domain'
import '../../src/renderer/src/styles.css'
import '../../src/renderer/src/refresh.css'

const seed = createInitialState()
const workspace = seed.workspaces[0]
const request = workspace.collections[0].requests[0]
request.method = 'POST'
request.params = [createKeyValue('sample', 'Bearer {{base_url}} tail')]
request.auth = { ...request.auth, type: 'bearer', token: '{{base_url}}' }
request.body = {
  mode: 'raw',
  rawType: 'json',
  content:
    '{\n  "name": "Postblack Windows cursor selection",\n  "token": "{{base_url}}",\n  "long": "' +
    'abcdefghij'.repeat(45) +
    '"\n}'
}
workspace.environments[0].variables[0].secret = false
window.postblack = {
  loadState: async () => JSON.parse(localStorage.getItem('ui-test-state') || JSON.stringify(seed)),
  saveState: async (state) => {
    localStorage.setItem('ui-test-state', JSON.stringify(state))
  },
  app: { info: async () => ({ platform: 'win32', version: 'test', architecture: 'x64' }) },
  ai: {
    state: async () => {
      throw new Error('disabled in fixture')
    }
  },
  updates: { check: async () => ({ status: 'current', currentVersion: 'test' }), onProgress: () => () => {} }
} as unknown as typeof window.postblack
createRoot(document.getElementById('root')!).render(<App />)
