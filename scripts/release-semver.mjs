const RELEASE_TYPES = ['major', 'minor', 'patch']

export function isReleaseType(value) {
  return RELEASE_TYPES.includes(value)
}

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)

  if (!match) {
    throw new Error(`Versão inválida: ${version}`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

export function bumpVersion(version, releaseType) {
  const current = parseVersion(version)

  if (!isReleaseType(releaseType)) {
    throw new Error(`Tipo de release inválido: ${releaseType}`)
  }

  if (releaseType === 'major') {
    return `${current.major + 1}.0.0`
  }

  if (releaseType === 'minor') {
    return `${current.major}.${current.minor + 1}.0`
  }

  return `${current.major}.${current.minor}.${current.patch + 1}`
}

export function classifyCommit(subject, body = '') {
  const normalizedSubject = subject.trim()
  const normalizedBody = body.trim()
  const breaking = /!\s*:/.test(normalizedSubject) || /BREAKING CHANGE:/i.test(normalizedBody)

  if (breaking) {
    return 'major'
  }

  if (/^feat(?:\([^)]*\))?:/i.test(normalizedSubject)) {
    return 'minor'
  }

  return 'patch'
}

export function inferReleaseType(commits) {
  let releaseType = 'patch'

  for (const commit of commits) {
    const commitType = classifyCommit(commit.subject, commit.body)

    if (commitType === 'major') {
      return 'major'
    }

    if (commitType === 'minor') {
      releaseType = 'minor'
    }
  }

  return releaseType
}

export function releaseSection(version, date, commits) {
  const lines = [`## ${version} — ${date}`, '']

  if (commits.length === 0) {
    lines.push('- Release inicial do Postblack.')
    return lines.join('\n')
  }

  for (const commit of commits) {
    lines.push(`- ${commit.subject} (${commit.hash})`)
  }

  return lines.join('\n')
}
