#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const landingRoot = resolve(root, 'landing', 'dist')
const htmlPath = resolve(landingRoot, 'index.html')
const scriptPath = resolve(landingRoot, 'app.js')
const requiredFiles = [
  htmlPath,
  scriptPath,
  resolve(landingRoot, 'styles.css'),
  resolve(landingRoot, 'assets', 'favicon.png'),
  resolve(landingRoot, 'assets', 'postblack-logo.png')
]

const missingFiles = requiredFiles.filter((path) => !existsSync(path))
if (missingFiles.length) {
  throw new Error(`Arquivos ausentes na landing:\n${missingFiles.join('\n')}`)
}

const html = readFileSync(htmlPath, 'utf8')
const requiredAnchors = ['produto', 'recursos', 'novidades', 'download']
for (const anchor of requiredAnchors) {
  if (!html.includes(`id="${anchor}"`)) {
    throw new Error(`Seção obrigatória ausente: #${anchor}`)
  }
}

const localReferences = [...html.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g)].map((match) => match[1])
for (const reference of localReferences) {
  if (!existsSync(resolve(landingRoot, reference))) {
    throw new Error(`Asset local não encontrado: ${reference}`)
  }
}

execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'inherit' })
console.log(`Landing validada: ${requiredFiles.length} arquivos e ${requiredAnchors.length} seções.`)
