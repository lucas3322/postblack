import { app, ipcMain } from 'electron'
import type { AppState, ExecuteRequestInput } from '../shared/domain'
import { generateCurl, importCurl } from '../shared/curl'
import { appStateSchema, executeRequestSchema } from '../shared/schemas'
import { executeHttpRequest } from './http-executor'
import { JsonStateStore } from './state-store'
import { checkForUpdates, downloadUpdate, openDownloadedUpdate, openLatestRelease } from './updater'

export const IPC_CHANNELS = {
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

export function registerIpcHandlers(store: JsonStateStore): void {
  ipcMain.handle(IPC_CHANNELS.loadState, () => store.load())
  ipcMain.handle(IPC_CHANNELS.saveState, (_event, rawState: AppState) =>
    store.save(appStateSchema.parse(rawState))
  )
  ipcMain.handle(IPC_CHANNELS.executeRequest, (_event, rawInput: ExecuteRequestInput) => {
    return executeHttpRequest(executeRequestSchema.parse(rawInput))
  })
  ipcMain.handle(IPC_CHANNELS.importCurl, (_event, command: string) => importCurl(command))
  ipcMain.handle(IPC_CHANNELS.generateCurl, (_event, rawInput: ExecuteRequestInput) => {
    const input = executeRequestSchema.parse(rawInput)
    return generateCurl(input.request, input.variables)
  })
  ipcMain.handle(IPC_CHANNELS.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    architecture: process.arch
  }))
  ipcMain.handle(IPC_CHANNELS.updateCheck, () => checkForUpdates())
  ipcMain.handle(IPC_CHANNELS.updateDownload, async (event) => {
    const path = await downloadUpdate((progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.updateProgress, progress)
      }
    })
    await openDownloadedUpdate(path)
    return { path }
  })
  ipcMain.handle(IPC_CHANNELS.updateOpenRelease, () => openLatestRelease())
}
