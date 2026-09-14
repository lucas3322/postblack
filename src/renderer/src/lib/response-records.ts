export interface ResponseRecords {
  rows: Record<string, unknown>[]
  columns: string[]
  numericColumns: string[]
  totalRows: number
}

export function responseRecords(body: string): ResponseRecords | null {
  if (body.length > 5_000_000) return null

  try {
    const parsed: unknown = JSON.parse(body)
    const source = findRecordArray(parsed)
    if (!source) return null

    const rows = source.filter(isRecord).slice(0, 500)
    const columns = [...new Set(rows.slice(0, 50).flatMap((row) => Object.keys(row)))].slice(0, 16)
    const numericColumns = columns.filter((column) =>
      rows.some((row) => typeof row[column] === 'number' && Number.isFinite(row[column]))
    )

    return { rows, columns, numericColumns, totalRows: source.length }
  } catch {
    return null
  }
}

export function displayCell(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function findRecordArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (!isRecord(value)) return null
  return (
    Object.values(value).find((item): item is unknown[] => Array.isArray(item) && item.some(isRecord)) ?? null
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
