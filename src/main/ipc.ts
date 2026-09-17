import { app, clipboard, dialog, ipcMain } from 'electron'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { z } from 'zod'
import type { AppState, ExecuteRequestInput, JsonFileExportInput } from '../shared/domain'
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
  copyText: 'postblack:clipboard:copy-text',
  exportJson: 'postblack:files:export-json',
  importJson: 'postblack:files:import-json',
  pickFile: 'postblack:files:pick',
  appInfo: 'postblack:app:info',
  updateCheck: 'postblack:update:check',
  updateDownload: 'postblack:update:download',
  updateOpenRelease: 'postblack:update:open-release',
  updateProgress: 'postblack:update:progress'
} as const

const jsonFileExportSchema = z.object({
  suggestedName: z.string().trim().min(1).max(180),
  contents: z.string().max(50_000_000)
})

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
  ipcMain.handle(IPC_CHANNELS.copyText, (_event, text: string) => {
    clipboard.writeText(z.string().max(50_000_000).parse(text))
  })
  ipcMain.handle(IPC_CHANNELS.exportJson, async (_event, rawInput: JsonFileExportInput) => {
    const input = jsonFileExportSchema.parse(rawInput)
    const result = await dialog.showSaveDialog({
      title: 'Exportar dados do Postblack',
      defaultPath: input.suggestedName,
      filters: [{ name: 'Arquivo JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await writeFile(result.filePath, input.contents, { encoding: 'utf8', mode: 0o600 })
    return { canceled: false, path: result.filePath, name: basename(result.filePath) }
  })
  ipcMain.handle(IPC_CHANNELS.importJson, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar workspace do Postblack',
      properties: ['openFile'],
      filters: [{ name: 'Arquivo JSON', extensions: ['json'] }]
    })
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { canceled: true }
    const contents = await readFile(filePath, 'utf8')
    if (Buffer.byteLength(contents, 'utf8') > 50_000_000) {
      throw new Error('O arquivo selecionado excede o limite de 50 MB.')
    }
    return { canceled: false, path: filePath, name: basename(filePath), contents }
  })
  ipcMain.handle(IPC_CHANNELS.pickFile, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar arquivo',
      properties: ['openFile']
    })
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { canceled: true }
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) throw new Error('O item selecionado não é um arquivo.')
    return {
      canceled: false,
      file: {
        path: filePath,
        name: basename(filePath),
        size: fileStat.size,
        mimeType: mimeTypeForPath(filePath)
      }
    }
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

function mimeTypeForPath(filePath: string): string {
  const extension = extname(filePath).toLowerCase()
  return (
    {
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    }[extension] ?? 'application/octet-stream'
  )
}
