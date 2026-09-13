import type { KeyValue, Workspace } from './domain'

const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g

export type VariableSegment =
  { kind: 'text'; value: string } | { kind: 'variable'; value: string; name: string }

export interface VariableDetail {
  value: string
  secret: boolean
  scope: 'global' | 'workspace' | 'environment'
}

export function splitVariableReferences(value: string): VariableSegment[] {
  const segments: VariableSegment[] = []
  let position = 0

  for (const match of value.matchAll(VARIABLE_PATTERN)) {
    if (match.index > position) segments.push({ kind: 'text', value: value.slice(position, match.index) })
    segments.push({ kind: 'variable', value: match[0], name: match[1] })
    position = match.index + match[0].length
  }

  if (position < value.length) segments.push({ kind: 'text', value: value.slice(position) })
  return segments
}

export function rowsToVariables(rows: KeyValue[]): Record<string, string> {
  return Object.fromEntries(
    rows.filter((row) => row.enabled && row.key.trim()).map((row) => [row.key.trim(), row.value])
  )
}

export function scopedVariables(globalVariables: KeyValue[], workspace: Workspace): Record<string, string> {
  const environment = workspace.environments.find((item) => item.id === workspace.activeEnvironmentId)
  return {
    ...rowsToVariables(globalVariables),
    ...rowsToVariables(workspace.variables),
    ...rowsToVariables(environment?.variables ?? [])
  }
}

export function scopedVariableDetails(
  globalVariables: KeyValue[],
  workspace: Workspace
): Record<string, VariableDetail> {
  const environment = workspace.environments.find((item) => item.id === workspace.activeEnvironmentId)
  const details: Record<string, VariableDetail> = {}

  for (const [scope, rows] of [
    ['global', globalVariables],
    ['workspace', workspace.variables],
    ['environment', environment?.variables ?? []]
  ] as const) {
    for (const row of rows) {
      const name = row.key.trim()
      if (row.enabled && name) details[name] = { value: row.value, secret: row.secret !== false, scope }
    }
  }

  return details
}

export function resolveVariables(value: string, variables: Record<string, string>): string {
  return value.replace(VARIABLE_PATTERN, (match, key: string) => variables[key] ?? match)
}

export function findUnresolvedVariables(value: string): string[] {
  return [...value.matchAll(VARIABLE_PATTERN)]
    .map((match) => match[1])
    .filter((key): key is string => Boolean(key))
}
