const PORTAL_HOST_ID = 'postblack-portal-host'

/**
 * Popovers are portaled to <body> so they escape clipping and the `filter` of color-vision modes,
 * which would otherwise break `position: fixed`. The host mirrors the `.app-shell` classes with
 * `display: contents`, so theme tokens and `.app-shell` selectors still reach portaled content.
 */
export function portalHost(): HTMLElement {
  let host = document.getElementById(PORTAL_HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = PORTAL_HOST_ID
    document.body.appendChild(host)
  }
  return host
}

export function syncPortalHost(shellClassName: string): void {
  portalHost().className = `${shellClassName} portal-host`
}
