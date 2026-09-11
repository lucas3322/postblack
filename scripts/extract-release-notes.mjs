#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const version = process.argv[2]?.replace(/^v/, '')

if (!version) {
  console.error('Uso: node scripts/extract-release-notes.mjs v1.2.3')
  process.exit(1)
}

const changelog = readFileSync(resolve(import.meta.dirname, '..', 'CHANGELOG.md'), 'utf8')
const lines = changelog.split('\n')
const sectionStart = lines.findIndex((line) => line.startsWith(`## ${version}`))

if (sectionStart === -1) {
  console.error(`Versão ${version} não encontrada em CHANGELOG.md`)
  process.exit(1)
}

const nextSectionOffset = lines.slice(sectionStart + 1).findIndex((line) => /^## \d+\.\d+\.\d+/.test(line))
const sectionEnd = nextSectionOffset === -1 ? lines.length : sectionStart + 1 + nextSectionOffset
const notes = lines
  .slice(sectionStart + 1, sectionEnd)
  .join('\n')
  .trim()

if (!notes) {
  console.error(`A versão ${version} não possui notas em CHANGELOG.md`)
  process.exit(1)
}

process.stdout.write(`${notes}\n`)
