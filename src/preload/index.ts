import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, ExecuteRequestInput, PostblackApi, UpdateProgress } from '../shared/domain'

const channels = {
  loadState: 'postblack:state:load',
  saveState: 'postblack:state:save',
  executeRequest: 'postblack:request:execute',
  importCurl: 'postblack:curl:import',
  generateCurl: 'postblack:curl:generate',
  appInfo: 'postblack:app:info',
  updateCheck: 'postblack:update:check',
  updateDownload: 'postblack:update:download',
  updateOpenRelease: 'postblack:update:open-release',
  updateProgress: 'postblack:update:progress'
} as const

const api: PostblackApi = {
  loadState: () => ipcRenderer.invoke(channels.loadState),
  saveState: (state: AppState) => ipcRenderer.invoke(channels.saveState, state),
  executeRequest: (input: ExecuteRequestInput) => ipcRenderer.invoke(channels.executeRequest, input),
  importCurl: (command: string) => ipcRenderer.invoke(channels.importCurl, command),
  generateCurl: (input: ExecuteRequestInput) => ipcRenderer.invoke(channels.generateCurl, input),
  app: {
    info: () => ipcRenderer.invoke(channels.appInfo)
  },
  updates: {
    check: () => ipcRenderer.invoke(channels.updateCheck),
    download: () => ipcRenderer.invoke(channels.updateDownload),
    openReleasePage: () => ipcRenderer.invoke(channels.updateOpenRelease),
    onProgress: (listener: (progress: UpdateProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: UpdateProgress): void =>
        listener(progress)
      ipcRenderer.on(channels.updateProgress, handler)
      return () => ipcRenderer.removeListener(channels.updateProgress, handler)
    }
  }
}

contextBridge.exposeInMainWorld('postblack', api)
