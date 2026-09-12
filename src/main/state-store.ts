import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppState } from '../shared/domain'
import { createInitialState } from '../shared/domain'
import { appStateSchema } from '../shared/schemas'

export class JsonStateStore {
  private readonly filePath = join(app.getPath('userData'), 'postblack-state.json')
  private pendingWrite: Promise<void> = Promise.resolve()

  async load(): Promise<AppState> {
    await this.pendingWrite.catch(() => undefined)
    try {
      const contents = await readFile(this.filePath, 'utf8')
      return appStateSchema.parse(JSON.parse(contents))
    } catch (error) {
      if (isMissingFile(error)) return createInitialState()
      console.error('Could not load Postblack state:', error)
      return createInitialState()
    }
  }

  async save(state: AppState): Promise<void> {
    const validState = appStateSchema.parse(state)
    const previousWrite = this.pendingWrite.catch(() => undefined)
    this.pendingWrite = previousWrite.then(() => this.write(validState))
    return this.pendingWrite
  }

  private async write(state: AppState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.tmp`
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, this.filePath)
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
