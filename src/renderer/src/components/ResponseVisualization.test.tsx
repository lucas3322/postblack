import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ResponseVisualization } from './ResponseVisualization'

const body = JSON.stringify([
  { name: 'A', score: 10 },
  { name: 'B', score: 20 }
])

describe('response visualization', () => {
  it('shows a bounded table for JSON records', () => {
    const html = renderToString(<ResponseVisualization body={body} mode="table" />)
    expect(html).toContain('<table>')
    expect(html).toContain('score')
    expect(html).toContain('Showing <!-- -->2<!-- --> of <!-- -->2<!-- --> rows')
  })

  it('plots a numeric field without executing response content', () => {
    const html = renderToString(<ResponseVisualization body={body} mode="bar" />)
    expect(html).toContain('Bar chart of score')
    expect(html).toContain('<rect')
  })
})
