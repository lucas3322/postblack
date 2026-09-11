import { describe, expect, it } from 'vitest'
import { bumpVersion, classifyCommit, inferReleaseType, releaseSection } from './release-semver.mjs'

describe('release semver', () => {
  it('incrementa versões semânticas', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4')
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0')
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
  })

  it('classifica conventional commits', () => {
    expect(classifyCommit('fix: corrige importação')).toBe('patch')
    expect(classifyCommit('feat(request): importa cURL')).toBe('minor')
    expect(classifyCommit('feat!: altera armazenamento')).toBe('major')
  })

  it('prioriza a maior alteração do conjunto', () => {
    expect(
      inferReleaseType([
        { subject: 'fix: melhora resposta', body: '' },
        { subject: 'feat: adiciona ambientes', body: '' }
      ])
    ).toBe('minor')
  })

  it('gera uma seção legível para o changelog', () => {
    expect(
      releaseSection('0.2.0', '2026-09-11', [
        { hash: 'abc1234', subject: 'feat: adiciona downloads', body: '' }
      ])
    ).toContain('feat: adiciona downloads (abc1234)')
  })
})
