#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { bumpVersion, inferReleaseType, isReleaseType, releaseSection } from './release-semver.mjs'

const root = resolve(import.meta.dirname, '..')
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const noPush = args.has('--no-push')
const allowDirty = args.has('--allow-dirty')
const forcedType = ['major', 'minor', 'patch'].find((type) => args.has(`--${type}`))

function runGit(parameters, options = {}) {
  const output = execFileSync('git', parameters, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe'
  })

  return typeof output === 'string' ? output.trim() : ''
}

function assertRepositoryIsReady() {
  try {
    runGit(['rev-parse', '--is-inside-work-tree'])
    runGit(['rev-parse', '--verify', 'HEAD'])
  } catch {
    throw new Error('Inicialize o Git e crie o primeiro commit antes de publicar uma release.')
  }

  const status = runGit(['status', '--porcelain'])
  if (status && !allowDirty && !dryRun) {
    throw new Error('Há arquivos não commitados. Faça commit ou use --allow-dirty conscientemente.')
  }
}

function latestTag() {
  try {
    return runGit(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'])
  } catch {
    return null
  }
}

function readCommits(tag) {
  const range = tag ? `${tag}..HEAD` : 'HEAD'
  const separator = '\u001f'
  const recordSeparator = '\u001e'
  const output = runGit(['log', range, `--pretty=format:%h${separator}%s${separator}%b${recordSeparator}`])

  if (!output) {
    return []
  }

  return output
    .split(recordSeparator)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body = ''] = record.split(separator)
      return { hash, subject, body }
    })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function updateVersions(version) {
  const packagePath = resolve(root, 'package.json')
  const lockPath = resolve(root, 'package-lock.json')
  const packageJson = readJson(packagePath)
  const packageLock = readJson(lockPath)

  packageJson.version = version
  packageLock.version = version

  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = version
  }

  writeJson(packagePath, packageJson)
  writeJson(lockPath, packageLock)
}

function updateChangelog(section) {
  const changelogPath = resolve(root, 'CHANGELOG.md')
  const current = readFileSync(changelogPath, 'utf8')
  const header = '# Changelog\n\n'
  const body = current.startsWith(header) ? current.slice(header.length) : current
  writeFileSync(changelogPath, `${header}${section}\n\n${body.trim()}\n`)
}

function printPlan(currentVersion, nextVersion, releaseType, tag, commits) {
  console.log(`Postblack ${currentVersion} → ${nextVersion}`)
  console.log(`Tipo: ${releaseType}`)
  console.log(`Última tag: ${tag ?? 'nenhuma'}`)
  console.log(`Commits incluídos: ${commits.length}`)
  commits.forEach((commit) => console.log(`  ${commit.hash} ${commit.subject}`))
}

function main() {
  assertRepositoryIsReady()

  const packageJson = readJson(resolve(root, 'package.json'))
  const tag = latestTag()
  const commits = readCommits(tag)
  const releaseType = forcedType ?? inferReleaseType(commits)
  const nextVersion = bumpVersion(packageJson.version, releaseType)
  const date = new Date().toISOString().slice(0, 10)
  const section = releaseSection(nextVersion, date, commits)

  printPlan(packageJson.version, nextVersion, releaseType, tag, commits)

  if (dryRun) {
    console.log('\nDry-run: nenhum arquivo, commit ou tag foi alterado.')
    return
  }

  updateVersions(nextVersion)
  updateChangelog(section)

  runGit(['add', 'package.json', 'package-lock.json', 'CHANGELOG.md'], { inherit: true })
  runGit(['commit', '-m', `chore(release): v${nextVersion}`], { inherit: true })
  runGit(['tag', '-a', `v${nextVersion}`, '-m', `Postblack v${nextVersion}`], { inherit: true })

  if (!noPush) {
    runGit(['push', 'origin', 'HEAD'], { inherit: true })
    runGit(['push', 'origin', `v${nextVersion}`], { inherit: true })
  }

  console.log(`\nRelease v${nextVersion} preparada${noPush ? ' localmente' : ' e enviada'}.`)
}

try {
  main()
} catch (error) {
  console.error(`Release cancelada: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
