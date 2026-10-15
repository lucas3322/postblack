import { buildAiSystemPrompt } from '../../shared/ai/prompt'
import { recordFailure, recordSuccess, routeProviders, type ProviderHealth } from '../../shared/ai/routing'
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiChatInput,
  type AiChatResult,
  type AiModelOption,
  type AiProviderId,
  type AiPublicState,
  type AiSettings,
  type AiTestResult
} from '../../shared/ai/types'
import type { AiStore } from './ai-store'
import { AiProviderError, type ProviderAdapter } from './providers'

export class AiService {
  private readonly health: Partial<Record<AiProviderId, ProviderHealth>> = {}
  private readonly modelCatalog: Partial<Record<AiProviderId, AiModelOption[]>> = {}

  constructor(
    private readonly store: AiStore,
    private readonly adapters: Record<AiProviderId, ProviderAdapter>,
    private readonly now: () => number = Date.now
  ) {}

  async publicState(): Promise<AiPublicState> {
    return { settings: await this.store.settings(), keys: await this.store.keyStatuses() }
  }

  async saveSettings(settings: AiSettings): Promise<AiPublicState> {
    await this.store.saveSettings(settings)
    return this.publicState()
  }

  async setKey(provider: AiProviderId, key: string | null): Promise<AiPublicState> {
    await this.store.setKey(provider, key)
    delete this.health[provider]
    delete this.modelCatalog[provider]
    if (key?.trim()) {
      // A freshly saved key turns its provider on, which is what the user expects.
      const settings = await this.store.settings()
      if (!settings.providers[provider].enabled) {
        await this.store.saveSettings({
          ...settings,
          providers: { ...settings.providers, [provider]: { ...settings.providers[provider], enabled: true } }
        })
      }
    }
    return this.publicState()
  }

  private async requireKey(provider: AiProviderId): Promise<string> {
    const key = await this.store.getKey(provider)
    if (!key) throw new Error(`Cadastre a chave de API do ${AI_PROVIDER_LABELS[provider]} primeiro.`)
    return key
  }

  async listModels(provider: AiProviderId): Promise<AiModelOption[]> {
    const models = await this.adapters[provider].listModels(await this.requireKey(provider))
    this.modelCatalog[provider] = models
    return models
  }

  async test(provider: AiProviderId): Promise<AiTestResult> {
    const started = this.now()
    try {
      const settings = await this.store.settings()
      const reply = await this.adapters[provider].chat({
        apiKey: await this.requireKey(provider),
        model: settings.providers[provider].model,
        system: 'Reply with reply = "ok" and an empty actions array.',
        messages: [{ role: 'user', content: 'ping' }]
      })
      const latencyMs = this.now() - started
      this.health[provider] = recordSuccess(this.health[provider], latencyMs)
      return { ok: true, message: `Conectado · ${reply.reply.slice(0, 40)}`, latencyMs }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Falha desconhecida.',
        latencyMs: this.now() - started
      }
    }
  }

  async chat(input: AiChatInput): Promise<AiChatResult> {
    const settings = await this.store.settings()
    const keys = await this.store.keyStatuses()
    const configured = Object.fromEntries(
      AI_PROVIDERS.map((provider) => [provider, keys[provider].configured])
    ) as Record<AiProviderId, boolean>
    const contextWindows = Object.fromEntries(
      AI_PROVIDERS.map((provider) => [
        provider,
        this.modelCatalog[provider]?.find((model) => model.id === settings.providers[provider].model)
          ?.contextWindow ?? null
      ])
    ) as Record<AiProviderId, number | null>

    const system = buildAiSystemPrompt(input.task)
    const messages = attachContext(input)
    const promptChars = system.length + messages.reduce((total, message) => total + message.content.length, 0)

    const route = routeProviders({
      settings,
      configured,
      health: this.health,
      contextWindows,
      promptChars,
      forced: input.provider,
      now: this.now()
    })
    if (!route.length) {
      throw new Error(
        input.provider
          ? `${AI_PROVIDER_LABELS[input.provider]} não está ativo ou não tem chave cadastrada.`
          : 'Nenhuma IA ativa. Cadastre uma chave em Configurações de IA.'
      )
    }

    const attempts: AiChatResult['attempts'] = []
    for (const candidate of route) {
      const started = this.now()
      try {
        const reply = await this.adapters[candidate.provider].chat({
          apiKey: await this.requireKey(candidate.provider),
          model: settings.providers[candidate.provider].model,
          system,
          messages
        })
        const latencyMs = this.now() - started
        this.health[candidate.provider] = recordSuccess(this.health[candidate.provider], latencyMs)
        return {
          reply,
          provider: candidate.provider,
          model: settings.providers[candidate.provider].model,
          latencyMs,
          attempts
        }
      } catch (error) {
        this.health[candidate.provider] = recordFailure(this.health[candidate.provider], this.now())
        const message = error instanceof Error ? error.message : 'Falha desconhecida.'
        attempts.push({ provider: candidate.provider, error: message })
        if (error instanceof AiProviderError && !error.retryable) break
      }
    }
    throw new Error(attempts.map((attempt) => attempt.error).join('\n'))
  }
}

/** The context rides on the latest user turn so earlier turns stay byte-identical (cacheable). */
export function attachContext(input: AiChatInput): AiChatInput['messages'] {
  const messages = [...input.messages]
  const last = messages.at(-1)
  if (!last || last.role !== 'user') return messages
  messages[messages.length - 1] = {
    role: 'user',
    content: `<postblack_context>\n${input.context}\n</postblack_context>\n\n${last.content}`
  }
  return messages
}
