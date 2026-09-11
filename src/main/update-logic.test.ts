import { describe, expect, it } from 'vitest'
import { compareVersions, normalizeVersion, selectReleaseAsset } from './update-logic'

const assets = [
  { name: 'Postblack-1.2.0-arm64.dmg', browser_download_url: 'arm', size: 10 },
  { name: 'Postblack-1.2.0-x64.dmg', browser_download_url: 'intel', size: 11 },
  { name: 'Postblack-Setup-1.2.0-x64.exe', browser_download_url: 'setup', size: 12 },
  { name: 'Postblack-Portable-1.2.0-x64.exe', browser_download_url: 'portable', size: 13 },
  { name: 'Postblack-1.2.0-x86_64.AppImage', browser_download_url: 'appimage', size: 14 }
]

describe('update logic', () => {
  it('normaliza e compara versões semânticas', () => {
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3')
    expect(compareVersions('1.3.0', '1.2.9')).toBeGreaterThan(0)
    expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBeLessThan(0)
    expect(compareVersions('1.2.0', '1.2.0')).toBe(0)
  })

  it('escolhe o DMG da arquitetura correta sem fallback perigoso', () => {
    expect(selectReleaseAsset(assets, 'darwin', 'arm64')?.browser_download_url).toBe('arm')
    expect(selectReleaseAsset(assets, 'darwin', 'x64')?.browser_download_url).toBe('intel')
    expect(selectReleaseAsset(assets, 'darwin', 'ia32')).toBeUndefined()
  })

  it('prioriza o instalador no Windows e AppImage no Linux', () => {
    expect(selectReleaseAsset(assets, 'win32', 'x64')?.browser_download_url).toBe('setup')
    expect(selectReleaseAsset(assets, 'linux', 'x64')?.browser_download_url).toBe('appimage')
    expect(selectReleaseAsset(assets, 'win32', 'arm64')).toBeUndefined()
    expect(selectReleaseAsset(assets, 'linux', 'arm64')).toBeUndefined()
  })
})
