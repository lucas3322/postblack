import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import {
  AI_PROVIDERS,
  aiSettingsSchema,
  createDefaultAiSettings,
  type AiKeyStatus,
  type AiProviderId,
  type AiSettings
} from '../../shared/ai/types'

/** Wraps Electron's safeStorage so the store can be tested without Electron. */
export interface SecretCipher {
  available: () => boolean
  encrypt: (plain: string) => Buffer
  decrypt: (cipher: Buffer) => string
}

const storedKeySchema = z.object({
  data: z.string(),
  encrypted: z.boolean(),
  hint: z.string()
})

const fileSchema = z.object({
  version: z.literal(1),
  settings: aiSettingsSchema,
  keys: z.partialRecord(z.enum(AI_PROVIDERS), storedKeySchema).default({})
})

type StoredFile = z.infer<typeof fileSchema>

export function keyHint(key: string): string {
  const trimmed = key.trim()
  return trimmed.length <= 8 ? '••••' : `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`
}

/**
 * Persists AI settings and API keys in their own file, separate from the workspace state, so
 * workspace exports and backups never contain keys. Keys are encrypted with the OS keychain
 * (safeStorage) when it is available.
 */
export class AiStore {
  private cache: StoredFile | null = null
  private pendingWrite: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly cipher: SecretCipher
  ) {}

  private async read(): Promise<StoredFile> {
    if (this.cache) return this.cache
    try {
      this.cache = fileSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch {
      this.cache = { version: 1, settings: createDefaultAiSettings(), keys: {} }
    }
    return this.cache
  }

  private async persist(next: StoredFile): Promise<void> {
    this.cache = next
    const previous = this.pendingWrite.catch(() => undefined)
    this.pendingWrite = previous.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporary = `${this.filePath}.tmp`
      await writeFile(temporary, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, this.filePath)
    })
    return this.pendingWrite
  }

  async settings(): Promise<AiSettings> {
    return (await this.read()).settings
  }

  async saveSettings(settings: AiSettings): Promise<AiSettings> {
    const file = await this.read()
    const valid = aiSettingsSchema.parse(settings)
    await this.persist({ ...file, settings: valid })
    return valid
  }

  async keyStatuses(): Promise<Record<AiProviderId, AiKeyStatus>> {
    const file = await this.read()
    return Object.fromEntries(
      AI_PROVIDERS.map((provider) => {
        const stored = file.keys[provider]
        return [
          provider,
          { configured: Boolean(stored), hint: stored?.hint ?? null, encrypted: stored?.encrypted ?? false }
        ]
      })
    ) as Record<AiProviderId, AiKeyStatus>
  }

  async setKey(provider: AiProviderId, key: string | null): Promise<void> {
    const file = await this.read()
    const keys = { ...file.keys }
    const trimmed = key?.trim() ?? ''
    if (!trimmed) {
      delete keys[provider]
    } else {
      const encrypted = this.cipher.available()
      keys[provider] = {
        data: encrypted
          ? this.cipher.encrypt(trimmed).toString('base64')
          : Buffer.from(trimmed, 'utf8').toString('base64'),
        encrypted,
        hint: keyHint(trimmed)
      }
    }
    await this.persist({ ...file, keys })
  }

  async getKey(provider: AiProviderId): Promise<string | null> {
    const stored = (await this.read()).keys[provider]
    if (!stored) return null
    const buffer = Buffer.from(stored.data, 'base64')
    return stored.encrypted ? this.cipher.decrypt(buffer) : buffer.toString('utf8')
  }
}
