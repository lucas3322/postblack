export interface SearchableCommand {
  id: string
  title: string
  subtitle?: string
  keywords?: string
}

/**
 * Scores how well `query` matches `text` as an ordered subsequence.
 * Returns -1 when not every query character is found in order.
 * Contiguous runs, word starts and an early first match score higher.
 */
export function fuzzyScore(query: string, text: string): number {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0
  const haystack = text.toLowerCase()

  const direct = haystack.indexOf(needle)
  if (direct !== -1) {
    const wordStart = direct === 0 || /[\s/_.\-{]/.test(haystack[direct - 1] ?? '')
    return 1000 - direct + (wordStart ? 200 : 0) + needle.length * 10
  }

  let score = 0
  let cursor = 0
  let previous = -2
  for (const character of needle) {
    if (character === ' ') continue
    const index = haystack.indexOf(character, cursor)
    if (index === -1) return -1
    if (index === previous + 1) score += 15
    if (index === 0 || /[\s/_.\-{]/.test(haystack[index - 1] ?? '')) score += 10
    score += 1
    previous = index
    cursor = index + 1
  }
  return score - Math.min(previous, 100) / 10
}

export function searchCommands<T extends SearchableCommand>(commands: T[], query: string, limit = 60): T[] {
  if (!query.trim()) return commands.slice(0, limit)

  return commands
    .map((command, order) => {
      const titleScore = fuzzyScore(query, command.title)
      const extraScore = Math.max(
        fuzzyScore(query, command.subtitle ?? ''),
        fuzzyScore(query, command.keywords ?? '')
      )
      const score = Math.max(titleScore * 1.5, extraScore)
      return { command, order, score }
    })
    .filter((entry) => entry.score >= 0)
    .sort((first, second) => second.score - first.score || first.order - second.order)
    .slice(0, limit)
    .map((entry) => entry.command)
}
