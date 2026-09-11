export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left)
  const rightVersion = parseVersion(right)

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftVersion.core[index] ?? 0) - (rightVersion.core[index] ?? 0)
    if (difference !== 0) return difference
  }

  if (leftVersion.prerelease === rightVersion.prerelease) return 0
  if (!leftVersion.prerelease) return 1
  if (!rightVersion.prerelease) return -1
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease)
}

export function selectReleaseAsset(
  assets: ReleaseAsset[],
  platform: NodeJS.Platform,
  architecture: string
): ReleaseAsset | undefined {
  const normalizedArchitecture = architecture.toLowerCase()
  const architectureNames = architectureAliases(normalizedArchitecture)
  const hasExtension = (asset: ReleaseAsset, extension: string): boolean =>
    asset.name.toLowerCase().endsWith(extension)
  const includes = (asset: ReleaseAsset, value: string): boolean => asset.name.toLowerCase().includes(value)
  const includesArchitecture = (asset: ReleaseAsset): boolean =>
    architectureNames.some((name) => includes(asset, name))

  if (platform === 'darwin') {
    return assets.find((asset) => hasExtension(asset, '.dmg') && includesArchitecture(asset))
  }

  if (platform === 'win32') {
    return (
      assets.find(
        (asset) => hasExtension(asset, '.exe') && includes(asset, 'setup') && includesArchitecture(asset)
      ) ??
      assets.find(
        (asset) => hasExtension(asset, '.exe') && includes(asset, 'portable') && includesArchitecture(asset)
      )
    )
  }

  if (platform === 'linux') {
    return assets.find((asset) => hasExtension(asset, '.appimage') && includesArchitecture(asset))
  }

  return undefined
}

function architectureAliases(architecture: string): string[] {
  if (architecture === 'x64') return ['x64', 'x86_64', 'amd64']
  if (architecture === 'arm64') return ['arm64', 'aarch64']
  return [architecture]
}

function parseVersion(version: string): { core: number[]; prerelease: string } {
  const [core, ...prerelease] = normalizeVersion(version).split('-')
  return {
    core: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
    prerelease: prerelease.join('-')
  }
}
