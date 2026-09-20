import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc'
import { JsonStateStore } from './state-store'

let mainWindow: BrowserWindow | null = null

function appIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon-512.png')
    : join(__dirname, '../../resources/icons/icon-512.png')
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'Postblack',
    icon: appIconPath(),
    backgroundColor: '#070b12',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow = window

  window.once('ready-to-show', () => focusMainWindow())
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  const rendererLoad = process.env['ELECTRON_RENDERER_URL']
    ? window.loadURL(process.env['ELECTRON_RENDERER_URL'])
    : window.loadFile(join(__dirname, '../renderer/index.html'))

  void rendererLoad
    .then(() => protectRendererNavigation(window))
    .catch((error) => handleLoadError(window, error))
}

function protectRendererNavigation(window: BrowserWindow): void {
  window.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    if (url.startsWith('https://')) void shell.openExternal(url)
  })
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function handleLoadError(window: BrowserWindow, error: unknown): void {
  console.error('Nao foi possivel carregar a interface do Postblack.', error)
  if (!window.isDestroyed()) window.show()
}

if (!app.isPackaged) {
  app.setName('Postblack Development')
  app.setPath('userData', join(app.getPath('appData'), 'Postblack Development'))
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (app.isReady()) focusMainWindow()
    else void app.whenReady().then(focusMainWindow)
  })

  void app.whenReady().then(() => {
    if (process.platform === 'darwin' && !app.isPackaged) app.dock.setIcon(appIconPath())
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
      callback(false)
    )
    registerIpcHandlers(new JsonStateStore())
    if (!mainWindow) createWindow()
    app.on('activate', focusMainWindow)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
