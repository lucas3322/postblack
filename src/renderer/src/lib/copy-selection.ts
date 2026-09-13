type TextSelection = Pick<Selection, 'anchorNode' | 'focusNode' | 'isCollapsed' | 'toString'>
type SelectionRegion = Pick<HTMLElement, 'contains'>

export function hasTextSelection(selection: Pick<TextSelection, 'isCollapsed' | 'toString'> | null): boolean {
  return Boolean(selection && !selection.isCollapsed && selection.toString().length)
}

export function selectedResponseText(
  selection: TextSelection | null,
  regions: Iterable<SelectionRegion>
): string | null {
  if (!selection || !hasTextSelection(selection) || !selection.anchorNode || !selection.focusNode) {
    return null
  }

  for (const region of regions) {
    if (region.contains(selection.anchorNode) && region.contains(selection.focusNode)) {
      return selection.toString()
    }
  }

  return null
}
