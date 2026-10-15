import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppState,
  ExecuteRequestInput,
  JsonFileExportInput,
  PostblackApi,
  UpdateProgress
} from '../shared/domain'

const channels = {
  loadState: 'postblack:state:load',
  saveState: 'postblack:state:save',
  executeRequest: 'postblack:request:execute',
  importCurl: 'postblack:curl:import',
  generateCurl: 'postblack:curl:generate',
  copyText: 'postblack:clipboard:copy-text',
  exportJson: 'postblack:files:export-json',
  importJson: 'postblack:files:import-json',
  pickFile: 'postblack:files:pick',
  appInfo: 'postblack:app:info',
  updateCheck: 'postblack:update:check',
  updateDownload: 'postblack:update:download',
  updateOpenRelease: 'postblack:update:open-release',
  updateProgress: 'postblack:update:progress',
  aiState: 'postblack:ai:state',
  aiSaveSettings: 'postblack:ai:save-settings',
  aiSetKey: 'postblack:ai:set-key',
  aiListModels: 'postblack:ai:list-models',
  aiTest: 'postblack:ai:test',
  aiChat: 'postblack:ai:chat'
} as const

const api: PostblackApi = {
  loadState: () => ipcRenderer.invoke(channels.loadState),
  saveState: (state: AppState) => ipcRenderer.invoke(channels.saveState, state),
  executeRequest: (input: ExecuteRequestInput) => ipcRenderer.invoke(channels.executeRequest, input),
  importCurl: (command: string) => ipcRenderer.invoke(channels.importCurl, command),
  generateCurl: (input: ExecuteRequestInput) => ipcRenderer.invoke(channels.generateCurl, input),
  clipboard: {
    copyText: (text: string) => ipcRenderer.invoke(channels.copyText, text)
  },
  files: {
    exportJson: (input: JsonFileExportInput) => ipcRenderer.invoke(channels.exportJson, input),
    importJson: () => ipcRenderer.invoke(channels.importJson),
    pickFile: () => ipcRenderer.invoke(channels.pickFile)
  },
  app: {
    info: () => ipcRenderer.invoke(channels.appInfo)
  },
  ai: {
    state: () => ipcRenderer.invoke(channels.aiState),
    saveSettings: (settings) => ipcRenderer.invoke(channels.aiSaveSettings, settings),
    setKey: (provider, key) => ipcRenderer.invoke(channels.aiSetKey, provider, key),
    listModels: (provider) => ipcRenderer.invoke(channels.aiListModels, provider),
    test: (provider) => ipcRenderer.invoke(channels.aiTest, provider),
    chat: (input) => ipcRenderer.invoke(channels.aiChat, input)
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
