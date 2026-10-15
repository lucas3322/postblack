import { z } from 'zod'

export const AI_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const
export type AiProviderId = (typeof AI_PROVIDERS)[number]

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
  gemini: 'Gemini'
}

/** Used until the user loads the live model list with their own key. */
export const AI_DEFAULT_MODELS: Record<AiProviderId, string> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5.5',
  gemini: 'gemini-3-flash-preview'
}

export type AiRoutingMode = 'smart' | 'priority'

export interface AiProviderSettings {
  enabled: boolean
  model: string
}

/** Settings visible to the renderer. API keys never leave the main process. */
export interface AiSettings {
  providers: Record<AiProviderId, AiProviderSettings>
  priority: AiProviderId[]
  routing: AiRoutingMode
  maskSecrets: boolean
  maxResponseChars: number
}

export interface AiKeyStatus {
  configured: boolean
  hint: string | null
  encrypted: boolean
}

export interface AiPublicState {
  settings: AiSettings
  keys: Record<AiProviderId, AiKeyStatus>
}

export interface AiModelOption {
  id: string
  label: string
  contextWindow: number | null
}

export interface AiTestResult {
  ok: boolean
  message: string
  latencyMs: number
}

export const AI_ACTION_TYPES = [
  'set_method',
  'set_url',
  'set_body',
  'upsert_header',
  'remove_header',
  'upsert_param',
  'remove_param',
  'set_auth',
  'curl'
] as const

/**
 * Every field is required and nullable so the same schema works with the strict structured-output
 * modes of all three providers.
 */
export const aiActionSchema = z.object({
  type: z.enum(AI_ACTION_TYPES),
  key: z.string().nullable(),
  value: z.string().nullable(),
  enabled: z.boolean().nullable(),
  bodyType: z.enum(['json', 'text', 'xml', 'html', 'none']).nullable(),
  authType: z.enum(['none', 'bearer', 'basic', 'api-key']).nullable(),
  label: z.string()
})

export const aiReplySchema = z.object({
  reply: z.string(),
  actions: z.array(aiActionSchema)
})

export type AiAction = z.infer<typeof aiActionSchema>
export type AiReply = z.infer<typeof aiReplySchema>

export type AiTask = 'explain' | 'edit' | 'curl' | 'chat'

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatInput {
  messages: AiChatMessage[]
  context: string
  task: AiTask
  /** null = let the router decide. */
  provider: AiProviderId | null
}

export interface AiChatResult {
  reply: AiReply
  provider: AiProviderId
  model: string
  latencyMs: number
  attempts: Array<{ provider: AiProviderId; error: string }>
}

export function createDefaultAiSettings(): AiSettings {
  return {
    providers: {
      anthropic: { enabled: false, model: AI_DEFAULT_MODELS.anthropic },
      openai: { enabled: false, model: AI_DEFAULT_MODELS.openai },
      gemini: { enabled: false, model: AI_DEFAULT_MODELS.gemini }
    },
    priority: ['anthropic', 'openai', 'gemini'],
    routing: 'smart',
    maskSecrets: true,
    maxResponseChars: 60_000
  }
}

const providerSettingsSchema = z.object({ enabled: z.boolean(), model: z.string().trim().min(1).max(200) })

export const aiSettingsSchema = z.object({
  providers: z.object({
    anthropic: providerSettingsSchema,
    openai: providerSettingsSchema,
    gemini: providerSettingsSchema
  }),
  priority: z
    .array(z.enum(AI_PROVIDERS))
    .length(3)
    .refine((items) => new Set(items).size === 3, 'Priority must list each provider once'),
  routing: z.enum(['smart', 'priority']),
  maskSecrets: z.boolean(),
  maxResponseChars: z.number().int().min(2_000).max(500_000)
})

export const aiChatInputSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(200_000) }))
    .min(1)
    .max(60),
  context: z.string().max(2_000_000),
  task: z.enum(['explain', 'edit', 'curl', 'chat']),
  provider: z.enum(AI_PROVIDERS).nullable()
})
