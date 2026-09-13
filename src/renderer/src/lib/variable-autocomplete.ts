export interface VariableQuery {
  start: number
  caret: number
  search: string
}

export function findVariableQuery(value: string, caret: number): VariableQuery | null {
  const beforeCaret = value.slice(0, caret)
  const start = beforeCaret.lastIndexOf('{{')
  if (start < 0) return null

  const search = beforeCaret.slice(start + 2)
  if (!/^\s*[^{}\s]*$/.test(search)) return null
  return { start, caret, search: search.trim() }
}

export function variableMatches(names: string[], search: string): string[] {
  const normalized = search.toLocaleLowerCase()
  return names.filter((name) => name.toLocaleLowerCase().includes(normalized)).slice(0, 8)
}

export function completeVariableQuery(
  value: string,
  query: VariableQuery,
  name: string
): { value: string; caret: number } {
  const suffixStart = value.slice(query.caret).startsWith('}}') ? query.caret + 2 : query.caret
  const reference = `{{${name}}}`
  return {
    value: value.slice(0, query.start) + reference + value.slice(suffixStart),
    caret: query.start + reference.length
  }
}
