export interface TextMatch {
  start: number
  end: number
}

const MAX_MATCHES = 10_000

export function findTextMatches(source: string, query: string, matchCase = false): TextMatch[] {
  if (!query) return []

  // Match against the original text so Unicode case folding cannot shift selection offsets.
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu')
  const matches: TextMatch[] = []
  let match: RegExpExecArray | null
  while (matches.length < MAX_MATCHES && (match = pattern.exec(source))) {
    matches.push({ start: match.index, end: match.index + match[0].length })
  }

  return matches
}

export function revealTextMatch(textarea: HTMLTextAreaElement, match: TextMatch): void {
  textarea.setSelectionRange(match.start, match.end)

  // A textarea does not reliably scroll to programmatic selections. Measure the same
  // wrapping in an offscreen mirror without moving focus away from the search input.
  const document = textarea.ownerDocument
  const style = document.defaultView!.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: 'border-box',
    width: `${textarea.clientWidth}px`,
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
    whiteSpace: style.whiteSpace,
    overflowWrap: style.overflowWrap,
    tabSize: style.tabSize
  })
  mirror.textContent = textarea.value.slice(0, match.start)
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(match.start, match.end) || '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  try {
    const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top
    const lineHeight = Number.parseFloat(style.lineHeight) || 18
    if (top < textarea.scrollTop + 44 || top + lineHeight > textarea.scrollTop + textarea.clientHeight) {
      textarea.scrollTop = Math.max(0, top - Math.max(44, textarea.clientHeight / 2))
    }
  } finally {
    mirror.remove()
  }
}

export function moveTextMatch(current: number, count: number, direction: 1 | -1): number {
  if (count === 0) return 0
  return (current + direction + count) % count
}
