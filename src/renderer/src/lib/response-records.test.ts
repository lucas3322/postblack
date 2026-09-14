import { describe, expect, it } from 'vitest'
import { responseRecords } from './response-records'

describe('JSON response visualization data', () => {
  it('extracts rows and numeric columns from arrays and common data envelopes', () => {
    const body = JSON.stringify({
      data: [
        { name: 'A', score: 10 },
        { name: 'B', score: 20 }
      ]
    })
    expect(responseRecords(body)).toMatchObject({
      totalRows: 2,
      columns: ['name', 'score'],
      numericColumns: ['score']
    })
  })

  it('rejects non-tabular bodies without evaluating content', () => {
    expect(responseRecords('<script>alert(1)</script>')).toBeNull()
    expect(responseRecords('{"ok":true}')).toBeNull()
  })
})
