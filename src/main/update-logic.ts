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
  const hasExtension = (asset: ReleaseAsset, extension: string): boolean =>
    asset.name.toLowerCase().endsWith(extension)
  const includes = (asset: ReleaseAsset, value: string): boolean => asset.name.toLowerCase().includes(value)

  if (platform === 'darwin') {
    return assets.find((asset) => hasExtension(asset, '.dmg') && includes(asset, normalizedArchitecture))
  }

  if (platform === 'win32') {
    return (
      assets.find(
        (asset) =>
          hasExtension(asset, '.exe') && includes(asset, 'setup') && includes(asset, normalizedArchitecture)
      ) ??
      assets.find(
        (asset) =>
          hasExtension(asset, '.exe') &&
          includes(asset, 'portable') &&
          includes(asset, normalizedArchitecture)
      )
    )
  }

  if (platform === 'linux') {
    return assets.find((asset) => hasExtension(asset, '.appimage') && includes(asset, normalizedArchitecture))
  }

  return undefined
}

function parseVersion(version: string): { core: number[]; prerelease: string } {
  const [core, ...prerelease] = normalizeVersion(version).split('-')
  return {
    core: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
    prerelease: prerelease.join('-')
  }
}
