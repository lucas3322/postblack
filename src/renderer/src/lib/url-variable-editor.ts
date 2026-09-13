export function insertVariableAtSelection(
  url: string,
  variableName: string,
  selectionStart: number,
  selectionEnd: number
): { value: string; caret: number } {
  const start = Math.max(0, Math.min(url.length, selectionStart))
  const end = Math.max(start, Math.min(url.length, selectionEnd))
  const reference = `{{${variableName}}}`
  return {
    value: url.slice(0, start) + reference + url.slice(end),
    caret: start + reference.length
  }
}
