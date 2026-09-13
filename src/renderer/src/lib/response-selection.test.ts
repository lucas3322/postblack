import { describe, expect, it } from 'vitest'
import type { ResponseSnapshot } from '../../../shared/domain'
import { responseForRequest } from './response-selection'

function snapshot(id: string, requestId: string): ResponseSnapshot {
  return {
    id,
    requestId,
    requestName: requestId,
    method: 'GET',
    url: 'https://example.com',
    status: 200,
    statusText: 'OK',
    durationMs: 10,
    sizeBytes: 2,
    headers: [],
    body: '{}',
    contentType: 'application/json',
    createdAt: '2026-09-13T00:00:00.000Z'
  }
}

describe('response selection', () => {
  const earlierA = snapshot('earlier-a', 'request-a')
  const latestA = snapshot('latest-a', 'request-a')
  const latestB = snapshot('latest-b', 'request-b')
  const history = [latestB, latestA, earlierA]

  it('restores the latest result for a request after switching away and back', () => {
    expect(responseForRequest('request-a', null, history)).toBe(latestA)
    expect(responseForRequest('request-b', null, history)).toBe(latestB)
  })

  it('uses an explicitly selected example or history result for the current request', () => {
    expect(responseForRequest('request-a', earlierA, history)).toBe(earlierA)
  })

  it('never displays the result of another request or a closed selection', () => {
    expect(responseForRequest('request-b', earlierA, history)).toBe(latestB)
    expect(responseForRequest(null, latestA, history)).toBeNull()
    expect(responseForRequest('unknown', latestA, history)).toBeNull()
  })
})
