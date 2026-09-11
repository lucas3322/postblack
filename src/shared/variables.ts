import type { KeyValue, Workspace } from './domain'

const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g

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

export function resolveVariables(value: string, variables: Record<string, string>): string {
  return value.replace(VARIABLE_PATTERN, (match, key: string) => variables[key] ?? match)
}

export function findUnresolvedVariables(value: string): string[] {
  return [...value.matchAll(VARIABLE_PATTERN)]
    .map((match) => match[1])
    .filter((key): key is string => Boolean(key))
}
