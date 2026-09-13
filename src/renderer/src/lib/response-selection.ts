import type { ResponseSnapshot } from '../../../shared/domain'

export function responseForRequest(
  requestId: string | null,
  currentResponse: ResponseSnapshot | null,
  history: ResponseSnapshot[]
): ResponseSnapshot | null {
  if (!requestId) return null
  if (currentResponse?.requestId === requestId) return currentResponse
  return history.find((item) => item.requestId === requestId) ?? null
}
