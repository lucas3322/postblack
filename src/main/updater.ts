import { createWriteStream } from 'node:fs'
import { chmod, copyFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, net, shell } from 'electron'
import type { UpdateInfo, UpdateProgress } from '../shared/domain'
import { compareVersions, normalizeVersion, selectReleaseAsset, type ReleaseAsset } from './update-logic'

const REPOSITORY = 'lucas3322/postblack'
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const RELEASE_PAGE = `https://github.com/${REPOSITORY}/releases/latest`
const MAC_GUIDE_FILE_NAME = 'COMO-ABRIR-POSTBLACK-NO-MAC.txt'

let lastSuccessfulCheck: UpdateInfo | null = null

export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()

  try {
    const response = await net.fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Postblack/${currentVersion}`
      }
    })

    if (response.status === 404) {
      return {
        status: 'error',
        currentVersion,
        message: 'O Postblack ainda não possui uma versão pública no GitHub.'
      }
    }

    if (response.status === 403) {
      return {
        status: 'error',
        currentVersion,
        message: 'O GitHub limitou as consultas temporariamente. Tente novamente mais tarde.'
      }
    }

    if (!response.ok) {
      return {
        status: 'error',
        currentVersion,
        message: `Não foi possível consultar as versões (HTTP ${response.status}).`
      }
    }

    const release = (await response.json()) as {
      tag_name?: string
      name?: string
      body?: string
      published_at?: string
      html_url?: string
      assets?: ReleaseAsset[]
    }
    const latestVersion = normalizeVersion(release.tag_name ?? release.name ?? '')

    if (!latestVersion) {
      return {
        status: 'error',
        currentVersion,
        message: 'A última release não possui um número de versão válido.'
      }
    }

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      const info: UpdateInfo = { status: 'current', currentVersion, latestVersion }
      lastSuccessfulCheck = info
      return info
    }

    const releaseDetails = {
      currentVersion,
      latestVersion,
      notes: release.body?.trim() || undefined,
      publishedAt: release.published_at,
      releasePageUrl: release.html_url
    }
    const asset = selectReleaseAsset(release.assets ?? [], process.platform, process.arch)
    const info: UpdateInfo = asset
      ? {
          ...releaseDetails,
          status: 'available',
          downloadUrl: asset.browser_download_url,
          fileName: asset.name,
          sizeBytes: asset.size
        }
      : {
          ...releaseDetails,
          status: 'missing-asset',
          message: `A versão ${latestVersion} não possui instalador para ${describePlatform()}.`
        }

    lastSuccessfulCheck = info
    return info
  } catch (error) {
    return {
      status: 'error',
      currentVersion,
      message: `Não foi possível acessar o GitHub: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

export async function downloadUpdate(onProgress: (progress: UpdateProgress) => void): Promise<string> {
  const info = lastSuccessfulCheck
  if (!info || info.status !== 'available' || !info.downloadUrl || !info.fileName) {
    throw new Error('Nenhuma atualização está pronta para download. Verifique novamente.')
  }

  const destination = join(app.getPath('downloads'), info.fileName)
  const partialDestination = `${destination}.partial`
  const response = await net.fetch(info.downloadUrl)

  if (!response.ok || !response.body) {
    throw new Error(`O download falhou (HTTP ${response.status}).`)
  }

  const totalBytes = Number(response.headers.get('content-length')) || info.sizeBytes || 0
  let receivedBytes = 0
  let lastProgressEvent = 0

  await rm(partialDestination, { force: true })
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    async function* (source) {
      for await (const chunk of source) {
        receivedBytes += (chunk as Buffer).length
        const now = Date.now()
        if (now - lastProgressEvent >= 150) {
          lastProgressEvent = now
          onProgress({ receivedBytes, totalBytes })
        }
        yield chunk
      }
    },
    createWriteStream(partialDestination)
  )

  if (info.sizeBytes) {
    const downloadedFile = await stat(partialDestination)
    if (downloadedFile.size !== info.sizeBytes) {
      await rm(partialDestination, { force: true })
      throw new Error('O download chegou incompleto. Tente novamente pela página da release.')
    }
  }

  await rm(destination, { force: true })
  await rename(partialDestination, destination)
  if (process.platform === 'darwin') {
    await copyMacInstallationGuideToDownloads()
  }
  if (process.platform === 'linux' && destination.toLowerCase().endsWith('.appimage')) {
    await chmod(destination, 0o755)
  }
  onProgress({ receivedBytes: totalBytes || receivedBytes, totalBytes })
  return destination
}

async function copyMacInstallationGuideToDownloads(): Promise<void> {
  const source = join(process.resourcesPath, MAC_GUIDE_FILE_NAME)
  const destination = join(app.getPath('downloads'), MAC_GUIDE_FILE_NAME)
  await copyFile(source, destination)
}

export async function openDownloadedUpdate(path: string): Promise<void> {
  const error = await shell.openPath(path)
  if (error) {
    shell.showItemInFolder(path)
    throw new Error(`Não foi possível abrir o instalador: ${error}`)
  }

  if (process.platform === 'darwin') {
    setTimeout(() => app.quit(), 1500)
  }
}

export async function openLatestRelease(): Promise<void> {
  await shell.openExternal(lastSuccessfulCheck?.releasePageUrl ?? RELEASE_PAGE)
}

function describePlatform(): string {
  const platform =
    process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux'
  return `${platform} ${process.arch}`
}
