import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import {
  aiReplySchema,
  type AiChatMessage,
  type AiModelOption,
  type AiProviderId,
  type AiReply
} from '../../shared/ai/types'

export interface ProviderChatInput {
  apiKey: string
  model: string
  system: string
  messages: AiChatMessage[]
}

export interface ProviderAdapter {
  chat: (input: ProviderChatInput) => Promise<AiReply>
  listModels: (apiKey: string) => Promise<AiModelOption[]>
}

const TIMEOUT_MS = 120_000
const MAX_OUTPUT_TOKENS = 16_000

/** Models that accept Anthropic's server-side refusal fallback. */
const ANTHROPIC_FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5'])

export class AiProviderError extends Error {
  constructor(
    message: string,
    /** Retrying the same request on another provider may succeed. */
    readonly retryable: boolean
  ) {
    super(message)
  }
}

function describeHttpError(provider: string, status: number | undefined, message: string): AiProviderError {
  if (status === 401 || status === 403)
    return new AiProviderError(`${provider}: chave de API inválida ou sem permissão.`, true)
  if (status === 404) return new AiProviderError(`${provider}: modelo não encontrado (${message}).`, true)
  if (status === 429)
    return new AiProviderError(`${provider}: limite de uso atingido. Tente mais tarde.`, true)
  if (status && status >= 500)
    return new AiProviderError(`${provider}: serviço indisponível (${status}).`, true)
  if (status === 400) return new AiProviderError(`${provider}: requisição recusada — ${message}`, true)
  return new AiProviderError(`${provider}: ${message}`, true)
}

const anthropic: ProviderAdapter = {
  async chat({ apiKey, model, system, messages }) {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 })
    try {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        output_config: { format: betaZodOutputFormat(aiReplySchema) },
        ...(ANTHROPIC_FALLBACK_MODELS.has(model)
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {})
      })
      if (response.stop_reason === 'refusal') throw new AiProviderError('Claude recusou este pedido.', true)
      if (response.stop_reason === 'max_tokens')
        throw new AiProviderError('Claude: a resposta passou do limite de tamanho.', true)
      if (!response.parsed_output)
        throw new AiProviderError('Claude: resposta fora do formato esperado.', true)
      return response.parsed_output
    } catch (error) {
      if (error instanceof AiProviderError) throw error
      if (error instanceof Anthropic.APIError) throw describeHttpError('Claude', error.status, error.message)
      throw new AiProviderError(
        `Claude: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
        true
      )
    }
  },
  async listModels(apiKey) {
    const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 })
    const models: AiModelOption[] = []
    try {
      for await (const model of client.models.list()) {
        models.push({
          id: model.id,
          label: model.display_name,
          contextWindow: model.max_input_tokens ?? null
        })
      }
    } catch (error) {
      if (error instanceof Anthropic.APIError) throw describeHttpError('Claude', error.status, error.message)
      throw error
    }
    return models
  }
}

const OPENAI_NON_CHAT =
  /(audio|realtime|tts|transcribe|image|embedding|search|moderation|dall-e|whisper|instruct|davinci|babbage|codex|computer-use|sora)/

const openai: ProviderAdapter = {
  async chat({ apiKey, model, system, messages }) {
    const client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 })
    try {
      const completion = await client.chat.completions.parse({
        model,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: system },
          ...messages.map((message) => ({ role: message.role, content: message.content }))
        ],
        response_format: zodResponseFormat(aiReplySchema, 'postblack_reply')
      })
      const message = completion.choices[0]?.message
      if (message?.refusal) throw new AiProviderError(`ChatGPT recusou: ${message.refusal}`, true)
      if (completion.choices[0]?.finish_reason === 'length')
        throw new AiProviderError('ChatGPT: a resposta passou do limite de tamanho.', true)
      if (!message?.parsed) throw new AiProviderError('ChatGPT: resposta fora do formato esperado.', true)
      return message.parsed
    } catch (error) {
      if (error instanceof AiProviderError) throw error
      if (error instanceof OpenAI.APIError) throw describeHttpError('ChatGPT', error.status, error.message)
      throw new AiProviderError(
        `ChatGPT: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
        true
      )
    }
  },
  async listModels(apiKey) {
    const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 })
    const models: AiModelOption[] = []
    try {
      for await (const model of client.models.list()) {
        if (!/^(gpt|o\d|chatgpt)/.test(model.id) || OPENAI_NON_CHAT.test(model.id)) continue
        models.push({ id: model.id, label: model.id, contextWindow: null })
      }
    } catch (error) {
      if (error instanceof OpenAI.APIError) throw describeHttpError('ChatGPT', error.status, error.message)
      throw error
    }
    return models.sort((first, second) => second.id.localeCompare(first.id))
  }
}

// Gemini rejects the $schema keyword, so it is dropped from the generated schema.
const { $schema: _ignored, ...geminiResponseSchema } = z.toJSONSchema(aiReplySchema)

const gemini: ProviderAdapter = {
  async chat({ apiKey, model, system, messages }) {
    const client = new GoogleGenAI({ apiKey })
    let text: string | undefined
    try {
      const response = await client.models.generateContent({
        model,
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
        config: {
          systemInstruction: system,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
          responseJsonSchema: geminiResponseSchema,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS)
        }
      })
      if (response.promptFeedback?.blockReason)
        throw new AiProviderError(`Gemini bloqueou o pedido (${response.promptFeedback.blockReason}).`, true)
      text = response.text
    } catch (error) {
      if (error instanceof AiProviderError) throw error
      const status =
        typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined
      throw describeHttpError('Gemini', status, error instanceof Error ? error.message : 'erro desconhecido')
    }
    try {
      return aiReplySchema.parse(JSON.parse(text ?? ''))
    } catch {
      throw new AiProviderError('Gemini: resposta fora do formato esperado.', true)
    }
  },
  async listModels(apiKey) {
    const client = new GoogleGenAI({ apiKey })
    const models: AiModelOption[] = []
    try {
      for await (const model of await client.models.list({ config: { pageSize: 100 } })) {
        if (!model.name || !model.supportedActions?.includes('generateContent')) continue
        if (!/gemini/i.test(model.name) || /(image|tts|embedding|audio|live|vision)/i.test(model.name))
          continue
        models.push({
          id: model.name.replace(/^models\//, ''),
          label: model.displayName ?? model.name,
          contextWindow: model.inputTokenLimit ?? null
        })
      }
    } catch (error) {
      const status =
        typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined
      throw describeHttpError('Gemini', status, error instanceof Error ? error.message : 'erro desconhecido')
    }
    return models
  }
}

export const PROVIDER_ADAPTERS: Record<AiProviderId, ProviderAdapter> = { anthropic, openai, gemini }
