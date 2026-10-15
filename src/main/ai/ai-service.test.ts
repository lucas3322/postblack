import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiProviderId } from '../../shared/ai/types'
import { AiService, attachContext } from './ai-service'
import { AiStore, keyHint, type SecretCipher } from './ai-store'
import { AiProviderError, type ProviderAdapter } from './providers'

vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }))
vi.mock('openai', () => ({ default: class {} }))
vi.mock('@google/genai', () => ({ GoogleGenAI: class {} }))

const cipher: SecretCipher = {
  available: () => true,
  encrypt: (plain) => Buffer.from(`enc:${plain}`),
  decrypt: (data) => data.toString().replace(/^enc:/, '')
}

function adapter(behavior: () => Promise<string>): ProviderAdapter {
  return {
    chat: vi.fn(async () => ({ reply: await behavior(), actions: [] })),
    listModels: vi.fn(async () => [{ id: 'model-x', label: 'Model X', contextWindow: 1000 }])
  }
}

describe('AiStore', () => {
  let directory: string
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'postblack-ai-'))
  })
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('encrypts keys at rest and only exposes a hint', async () => {
    const store = new AiStore(join(directory, 'ai.json'), cipher)
    await store.setKey('openai', '  sk-proj-1234567890  ')
    const onDisk = await readFile(join(directory, 'ai.json'), 'utf8')
    expect(onDisk).not.toContain('sk-proj-1234567890')
    expect(await store.getKey('openai')).toBe('sk-proj-1234567890')
    expect((await store.keyStatuses()).openai).toEqual({
      configured: true,
      hint: 'sk-…7890',
      encrypted: true
    })

    const reopened = new AiStore(join(directory, 'ai.json'), cipher)
    expect(await reopened.getKey('openai')).toBe('sk-proj-1234567890')
    await reopened.setKey('openai', null)
    expect((await reopened.keyStatuses()).openai.configured).toBe(false)
  })

  it('short keys get an opaque hint', () => {
    expect(keyHint('abc')).toBe('••••')
  })
})

describe('AiService', () => {
  let directory: string
  let store: AiStore
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'postblack-ai-'))
    store = new AiStore(join(directory, 'ai.json'), cipher)
  })
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  const input = {
    messages: [{ role: 'user' as const, content: 'explica' }],
    context: 'ctx',
    task: 'explain' as const,
    provider: null
  }

  it('saving a key enables the provider', async () => {
    const service = new AiService(store, {
      anthropic: adapter(async () => 'a'),
      openai: adapter(async () => 'o'),
      gemini: adapter(async () => 'g')
    })
    const state = await service.setKey('gemini', 'AIza-test-key')
    expect(state.settings.providers.gemini.enabled).toBe(true)
    expect(state.keys.gemini.configured).toBe(true)
  })

  it('falls back to the next provider and reports the failed attempt', async () => {
    const adapters: Record<AiProviderId, ProviderAdapter> = {
      anthropic: adapter(async () => {
        throw new AiProviderError('Claude: limite de uso atingido.', true)
      }),
      openai: adapter(async () => 'from openai'),
      gemini: adapter(async () => 'from gemini')
    }
    const service = new AiService(store, adapters)
    await service.setKey('anthropic', 'sk-ant-1')
    await service.setKey('openai', 'sk-2')

    const result = await service.chat(input)
    expect(result.provider).toBe('openai')
    expect(result.reply.reply).toBe('from openai')
    expect(result.attempts).toEqual([{ provider: 'anthropic', error: 'Claude: limite de uso atingido.' }])

    // The failed provider is now cooling down, so smart routing goes straight to OpenAI.
    await service.chat(input)
    expect(adapters.anthropic.chat).toHaveBeenCalledTimes(1)
  })

  it('explains when no provider is ready', async () => {
    const service = new AiService(store, {
      anthropic: adapter(async () => 'a'),
      openai: adapter(async () => 'o'),
      gemini: adapter(async () => 'g')
    })
    await expect(service.chat(input)).rejects.toThrow('Nenhuma IA ativa')
  })

  it('attaches the context to the latest user message only', () => {
    expect(
      attachContext({
        ...input,
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'answer' },
          { role: 'user', content: 'second' }
        ]
      })
    ).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: '<postblack_context>\nctx\n</postblack_context>\n\nsecond' }
    ])
  })
})
