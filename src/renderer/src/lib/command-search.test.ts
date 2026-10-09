import { describe, expect, it } from 'vitest'
import { fuzzyScore, searchCommands } from './command-search'

const commands = [
  { id: 'a', title: 'List purchases', subtitle: 'GET {{base_url}}/purchases' },
  { id: 'b', title: 'Create purchase', subtitle: 'POST {{base_url}}/purchases' },
  { id: 'c', title: 'Import OpenAPI / Swagger', keywords: 'openapi swagger json spec' },
  { id: 'd', title: 'Open history' }
]

describe('fuzzyScore', () => {
  it('rejects characters out of order', () => {
    expect(fuzzyScore('zx', 'xyz')).toBe(-1)
  })

  it('prefers direct substring matches over scattered ones', () => {
    expect(fuzzyScore('purch', 'List purchases')).toBeGreaterThan(fuzzyScore('lps', 'List purchases'))
  })

  it('treats an empty query as a neutral match', () => {
    expect(fuzzyScore('  ', 'anything')).toBe(0)
  })
})

describe('searchCommands', () => {
  it('keeps the original order without a query', () => {
    expect(searchCommands(commands, '').map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('matches titles, subtitles and keywords', () => {
    expect(searchCommands(commands, 'swagger').map((item) => item.id)).toEqual(['c'])
    expect(searchCommands(commands, 'post').map((item) => item.id)).toContain('b')
  })

  it('ranks title matches first', () => {
    expect(searchCommands(commands, 'create')[0]?.id).toBe('b')
  })

  it('supports scattered abbreviations', () => {
    expect(searchCommands(commands, 'ohis').map((item) => item.id)).toEqual(['d'])
  })
})
