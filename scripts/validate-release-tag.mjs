#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const tag = process.argv[2]

if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`Tag de release inválida: ${tag ?? 'não informada'}. Use vX.Y.Z.`)
}

const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const expectedTag = `v${packageJson.version}`

if (tag !== expectedTag) {
  throw new Error(`A tag ${tag} não corresponde à versão ${packageJson.version} do package.json.`)
}

const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8')
if (!changelog.split('\n').some((line) => line.startsWith(`## ${packageJson.version}`))) {
  throw new Error(`A versão ${packageJson.version} não possui uma seção no CHANGELOG.md.`)
}

console.log(`Tag ${tag}, package.json e CHANGELOG.md estão sincronizados.`)
