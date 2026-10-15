import type { ReactNode } from 'react'

export type MarkdownBlock =
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; text: string }

/** Splits the small Markdown subset the assistant uses into blocks. */
export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/)
    if (fence) {
      const code: string[] = []
      index++
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? '')) code.push(lines[index++] ?? '')
      index++
      blocks.push({ kind: 'code', language: fence[1] ?? '', text: code.join('\n') })
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2] ?? '' })
      index++
      continue
    }
    const listItem = /^\s*([-*•]|\d+[.)])\s+/
    if (listItem.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const items: string[] = []
      while (index < lines.length && listItem.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(listItem, ''))
        index++
      }
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    if (!line.trim()) {
      index++
      continue
    }
    const paragraph: string[] = []
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() &&
      !/^\s*```/.test(lines[index] ?? '') &&
      !/^#{1,4}\s/.test(lines[index] ?? '') &&
      !listItem.test(lines[index] ?? '')
    ) {
      paragraph.push(lines[index++] ?? '')
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') })
  }
  return blocks
}

/** Renders `code`, **bold** and *italic* spans as React nodes (never as HTML). */
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g
  let position = 0
  let key = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > position) nodes.push(text.slice(position, match.index))
    const token = match[0]
    if (token.startsWith('`')) nodes.push(<code key={key++}>{token.slice(1, -1)}</code>)
    else if (token.startsWith('**')) nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    else nodes.push(<em key={key++}>{token.slice(1, -1)}</em>)
    position = match.index + token.length
  }
  if (position < text.length) nodes.push(text.slice(position))
  return nodes
}

export function MiniMarkdown({
  source,
  renderCode
}: {
  source: string
  renderCode: (text: string, language: string) => ReactNode
}): React.JSX.Element {
  return (
    <div className="mini-markdown">
      {parseMarkdown(source).map((block, index) => {
        switch (block.kind) {
          case 'code':
            return <div key={index}>{renderCode(block.text, block.language)}</div>
          case 'heading':
            return <h4 key={index}>{renderInline(block.text)}</h4>
          case 'list': {
            const List = block.ordered ? 'ol' : 'ul'
            return (
              <List key={index}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </List>
            )
          }
          default:
            return <p key={index}>{renderInline(block.text)}</p>
        }
      })}
    </div>
  )
}
