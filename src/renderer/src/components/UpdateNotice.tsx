import { CheckCircle2, Download, ExternalLink, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { UpdateInfo, UpdateProgress } from '../../../shared/domain'

const DISMISSED_VERSION_KEY = 'postblack.update.dismissed-version'
const AUTOMATIC_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

interface UpdateNoticeProps {
  manualCheckToken: number
}

export function UpdateNotice({ manualCheckToken }: UpdateNoticeProps): React.JSX.Element | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const check = useCallback(async (showEveryResult: boolean): Promise<void> => {
    setChecking(true)
    setDownloadError(null)

    try {
      const result = await window.postblack.updates.check()
      const isNewVersion = result.status === 'available' || result.status === 'missing-asset'
      const wasDismissed = localStorage.getItem(DISMISSED_VERSION_KEY) === result.latestVersion

      if (showEveryResult || (isNewVersion && !wasDismissed)) {
        setInfo(result)
      }
    } catch (error) {
      if (showEveryResult) {
        setInfo({
          status: 'error',
          currentVersion: '',
          message: error instanceof Error ? error.message : 'A verificação não pôde ser concluída.'
        })
      }
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void check(false), 3000)
    const interval = window.setInterval(() => void check(false), AUTOMATIC_CHECK_INTERVAL_MS)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [check])

  useEffect(() => {
    if (manualCheckToken > 0) void check(true)
  }, [check, manualCheckToken])

  useEffect(() => window.postblack.updates.onProgress(setProgress), [])

  const dismiss = (): void => {
    if (info?.latestVersion && (info.status === 'available' || info.status === 'missing-asset')) {
      localStorage.setItem(DISMISSED_VERSION_KEY, info.latestVersion)
    }
    setInfo(null)
    setProgress(null)
    setDownloadError(null)
  }

  const startDownload = async (): Promise<void> => {
    if (!info) return

    if (info.status === 'missing-asset') {
      await window.postblack.updates.openReleasePage()
      return
    }

    setDownloading(true)
    setProgress({ receivedBytes: 0, totalBytes: info.sizeBytes ?? 0 })
    setDownloadError(null)
    try {
      await window.postblack.updates.download()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'O download não pôde ser concluído.')
    } finally {
      setDownloading(false)
    }
  }

  if (!info && !checking) return null

  const percentage = progress?.totalBytes
    ? Math.min(100, Math.round((progress.receivedBytes / progress.totalBytes) * 100))
    : 0
  const isAvailable = info?.status === 'available' || info?.status === 'missing-asset'

  return (
    <aside className="update-notice" role="status" aria-live="polite">
      <button className="update-notice-close" onClick={dismiss} aria-label="Fechar aviso">
        <X size={14} />
      </button>

      {checking && !info ? (
        <div className="update-notice-state">
          <RefreshCw className="spin" size={18} />
          <div>
            <strong>Verificando atualizações</strong>
            <p>Consultando os releases do Postblack…</p>
          </div>
        </div>
      ) : info?.status === 'current' ? (
        <div className="update-notice-state">
          <CheckCircle2 className="update-success" size={19} />
          <div>
            <strong>Postblack está atualizado</strong>
            <p>Você já está usando a versão {info.currentVersion}.</p>
          </div>
        </div>
      ) : info?.status === 'error' ? (
        <div className="update-notice-state">
          <RefreshCw size={18} />
          <div>
            <strong>Não foi possível verificar</strong>
            <p>{info.message}</p>
          </div>
        </div>
      ) : isAvailable ? (
        <>
          <div className="update-notice-heading">
            <div className="update-icon">
              <Download size={18} />
            </div>
            <div>
              <strong>Nova versão disponível</strong>
              <p>
                Postblack {info.latestVersion} <span>•</span> instalada {info.currentVersion}
              </p>
            </div>
          </div>

          {downloading && (
            <div className="update-progress">
              <div className="update-progress-label">
                <span>Baixando {info.fileName}</span>
                <b>{progress?.totalBytes ? `${percentage}%` : formatBytes(progress?.receivedBytes ?? 0)}</b>
              </div>
              <div className="update-progress-track">
                <div
                  className={progress?.totalBytes ? '' : 'indeterminate'}
                  style={progress?.totalBytes ? { width: `${percentage}%` } : undefined}
                />
              </div>
            </div>
          )}

          {downloadError && <p className="update-error">{downloadError}</p>}

          {isMacOs() && info.status === 'available' && !downloading && !downloadError && (
            <p className="update-macos-guide">
              O guia para abrir builds não assinados será salvo junto do instalador.
            </p>
          )}

          <div className="update-notice-actions">
            <button className="button quiet" onClick={dismiss} disabled={downloading}>
              Agora não
            </button>
            <button className="button primary" onClick={() => void startDownload()} disabled={downloading}>
              {info.status === 'missing-asset' ? <ExternalLink size={14} /> : <Download size={14} />}
              {downloading
                ? 'Baixando…'
                : info.status === 'missing-asset'
                  ? 'Abrir release'
                  : 'Baixar atualização'}
            </button>
          </div>
        </>
      ) : null}
    </aside>
  )
}

function isMacOs(): boolean {
  return /mac/i.test(navigator.platform || navigator.userAgent)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
