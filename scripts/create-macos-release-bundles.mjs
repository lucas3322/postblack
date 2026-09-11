#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const releaseDirectory = resolve(root, 'release')
const guideSource = resolve(root, 'docs', 'COMO-ABRIR-POSTBLACK-NO-MAC.txt')
const guideTarget = resolve(releaseDirectory, 'COMO-ABRIR-POSTBLACK-NO-MAC.txt')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

if (!existsSync(guideSource)) {
  throw new Error(`Guia do macOS nao encontrado: ${guideSource}`)
}

copyFileSync(guideSource, guideTarget)

for (const architecture of ['arm64', 'x64']) {
  const dmg = resolve(releaseDirectory, `Postblack-${version}-${architecture}.dmg`)
  const bundle = resolve(releaseDirectory, `Postblack-${version}-${architecture}-macOS.zip`)

  if (!existsSync(dmg)) {
    throw new Error(`Instalador do macOS nao encontrado: ${dmg}`)
  }

  execFileSync('zip', ['-j', '-q', bundle, dmg, guideTarget], { stdio: 'inherit' })
  console.log(`Kit criado: ${bundle}`)
}
