import { describe, expect, it } from 'vitest'
import { hasTextSelection, selectedResponseText } from './copy-selection'

function selection(text: string, anchorNode: object, focusNode = anchorNode) {
  return {
    anchorNode: anchorNode as Node,
    focusNode: focusNode as Node,
    isCollapsed: text.length === 0,
    toString: () => text
  }
}

describe('copy selection', () => {
  it('lets the native copy shortcut handle highlighted text', () => {
    expect(hasTextSelection(selection('selected token', {}))).toBe(true)
    expect(hasTextSelection(selection('', {}))).toBe(false)
    expect(hasTextSelection(null)).toBe(false)
  })

  it('copies only text selected inside the response', () => {
    const responseNode = {}
    const region = { contains: (node: Node) => node === responseNode }

    expect(selectedResponseText(selection('selected token', responseNode), [region])).toBe('selected token')
    expect(selectedResponseText(selection('outside', {}), [region])).toBeNull()
    expect(selectedResponseText(selection('crossed', responseNode, {}), [region])).toBeNull()
  })
})
