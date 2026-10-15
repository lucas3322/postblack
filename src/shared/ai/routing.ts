import type { AiProviderId, AiSettings } from './types'

export interface ProviderHealth {
  /** Epoch ms of the last failure; the provider is deprioritized for a cooldown afterwards. */
  lastFailureAt: number | null
  consecutiveFailures: number
  /** Exponential moving average of successful latency. */
  averageLatencyMs: number | null
}

export interface RouteCandidate {
  provider: AiProviderId
  reason: string
}

export const FAILURE_COOLDOWN_MS = 90_000
/** Rough characters-per-token ratio used to check that a prompt fits the model's window. */
const CHARS_PER_TOKEN = 3.5

export interface RouteInput {
  settings: AiSettings
  configured: Record<AiProviderId, boolean>
  health: Partial<Record<AiProviderId, ProviderHealth>>
  contextWindows: Partial<Record<AiProviderId, number | null>>
  promptChars: number
  forced: AiProviderId | null
  now: number
}

/**
 * Orders the providers to try. The first entry is the pick; the rest are the fallback chain.
 *
 * - priority: user order, skipping disabled or keyless providers.
 * - smart: user order, then demotes providers that recently failed (cooldown) or whose model
 *   cannot fit the prompt. Among healthy providers whose priority is adjacent, a much faster one
 *   (by measured latency) moves up for short prompts.
 */
export function routeProviders(input: RouteInput): RouteCandidate[] {
  const available = input.settings.priority.filter(
    (provider) => input.settings.providers[provider].enabled && input.configured[provider]
  )

  if (input.forced) {
    if (!available.includes(input.forced)) return []
    return [
      { provider: input.forced, reason: 'chosen manually' },
      ...available
        .filter((provider) => provider !== input.forced)
        .map((provider) => ({ provider, reason: 'fallback' }))
    ]
  }

  if (input.settings.routing === 'priority') {
    return available.map((provider, index) => ({
      provider,
      reason: index === 0 ? 'highest priority' : 'fallback'
    }))
  }

  const estimatedTokens = Math.ceil(input.promptChars / CHARS_PER_TOKEN)
  const scored = available.map((provider, index) => {
    const health = input.health[provider]
    const window = input.contextWindows[provider] ?? null
    const coolingDown = Boolean(
      health?.lastFailureAt && input.now - health.lastFailureAt < FAILURE_COOLDOWN_MS
    )
    const tooLarge = window !== null && estimatedTokens > window * 0.9
    let score = index * 10
    if (coolingDown) score += 100 + (health?.consecutiveFailures ?? 1) * 5
    if (tooLarge) score += 1000
    return { provider, index, score, coolingDown, tooLarge, latency: health?.averageLatencyMs ?? null }
  })

  // Short prompts are latency-bound: let a provider at most one priority step down win if it has
  // proven to be at least twice as fast.
  if (estimatedTokens < 4_000) {
    for (let index = 1; index < scored.length; index++) {
      const previous = scored[index - 1]!
      const current = scored[index]!
      if (
        !current.coolingDown &&
        !current.tooLarge &&
        !previous.coolingDown &&
        current.latency !== null &&
        previous.latency !== null &&
        current.latency * 2 < previous.latency &&
        current.score - previous.score <= 10
      ) {
        current.score = previous.score - 1
      }
    }
  }

  return scored
    .sort((first, second) => first.score - second.score || first.index - second.index)
    .map((entry, position) => ({
      provider: entry.provider,
      reason:
        position > 0
          ? 'fallback'
          : entry.index === 0
            ? 'highest priority'
            : scored.some((other) => other.index < entry.index && other.coolingDown)
              ? 'higher priority provider failed recently'
              : scored.some((other) => other.index < entry.index && other.tooLarge)
                ? 'larger context window needed'
                : 'faster for short prompts'
    }))
}

export function recordSuccess(health: ProviderHealth | undefined, latencyMs: number): ProviderHealth {
  const average = health?.averageLatencyMs
  return {
    lastFailureAt: null,
    consecutiveFailures: 0,
    averageLatencyMs: average == null ? latencyMs : Math.round(average * 0.7 + latencyMs * 0.3)
  }
}

export function recordFailure(health: ProviderHealth | undefined, now: number): ProviderHealth {
  return {
    lastFailureAt: now,
    consecutiveFailures: (health?.consecutiveFailures ?? 0) + 1,
    averageLatencyMs: health?.averageLatencyMs ?? null
  }
}
