const REPOSITORY = 'lucas3322/postblack'
const GITHUB_URL = `https://github.com/${REPOSITORY}`
const RELEASES_URL = `${GITHUB_URL}/releases`

const fallbackRelease = {
  tag_name: 'v0.1.0',
  name: 'Primeira versão pública',
  published_at: '2026-09-11T00:00:00Z',
  html_url: RELEASES_URL,
  body: [
    'Cliente HTTP desktop com persistência local',
    'Importação de cURL diretamente pela barra de URL',
    'Variáveis globais, de workspace e de ambiente',
    'Resposta JSON com cores por tipo de valor'
  ].join('\n'),
  assets: []
}

function configureLinks() {
  document.querySelectorAll('[data-github-link]').forEach((link) => {
    link.href = GITHUB_URL
  })
  document.querySelectorAll('[data-releases-link]').forEach((link) => {
    link.href = RELEASES_URL
  })
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

function notesFromBody(body) {
  return (body || '')
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').replace(/^#+\s+/, '').trim())
    .filter((line) => line && !/^changelog$/i.test(line))
    .slice(0, 4)
}

function appendNote(list, note) {
  const item = document.createElement('li')
  const commitMatch = note.match(/\(([a-f0-9]{7,40})\)$/i)

  if (!commitMatch) {
    item.textContent = note
    list.append(item)
    return
  }

  item.append(document.createTextNode(note.slice(0, commitMatch.index)))
  const commitLink = document.createElement('a')
  commitLink.className = 'commit-link'
  commitLink.href = `${GITHUB_URL}/commit/${commitMatch[1]}`
  commitLink.textContent = commitMatch[1]
  commitLink.target = '_blank'
  commitLink.rel = 'noreferrer'
  item.append(commitLink)
  list.append(item)
}

function renderReleases(releases, isFallback = false) {
  const feed = document.querySelector('#release-feed')
  feed.replaceChildren()

  releases.slice(0, 3).forEach((release, index) => {
    const card = document.createElement('article')
    card.className = `release-card${index === 0 ? ' featured' : ''}`

    const top = document.createElement('div')
    top.className = 'release-top'
    const version = document.createElement('a')
    version.className = 'release-version'
    version.href = release.html_url || RELEASES_URL
    version.textContent = release.tag_name || release.name
    const date = document.createElement('time')
    date.className = 'release-date'
    date.dateTime = release.published_at
    date.textContent = formatDate(release.published_at)
    top.append(version, date)

    const title = document.createElement('h3')
    title.textContent = release.name || `Postblack ${release.tag_name}`
    const list = document.createElement('ul')
    list.className = 'release-list'
    const notes = notesFromBody(release.body)
    ;(notes.length ? notes : ['Correções e melhorias desta versão.']).forEach((note) => appendNote(list, note))

    card.append(top, title, list)
    feed.append(card)
  })

  feed.setAttribute('aria-busy', 'false')
  document.querySelector('#feed-status').textContent = isFallback
    ? 'As próximas notas serão sincronizadas automaticamente após o primeiro GitHub Release.'
    : 'Notas sincronizadas com os GitHub Releases.'
}

function assetMatches(name, key) {
  const normalized = name.toLowerCase()
  const rules = {
    'mac-arm64': normalized.endsWith('.dmg') && normalized.includes('arm64'),
    'mac-x64': normalized.endsWith('.dmg') && normalized.includes('x64'),
    'win-setup': normalized.endsWith('.exe') && normalized.includes('setup'),
    'win-portable': normalized.endsWith('.exe') && normalized.includes('portable'),
    'linux-appimage': normalized.endsWith('.appimage'),
    'linux-deb': normalized.endsWith('.deb')
  }
  return rules[key]
}

function configureDownloads(release) {
  document.querySelectorAll('[data-asset]').forEach((link) => {
    const asset = release.assets?.find((candidate) => assetMatches(candidate.name, link.dataset.asset))
    link.href = asset?.browser_download_url || release.html_url || RELEASES_URL
    if (asset) link.setAttribute('download', '')
  })

  const version = (release.tag_name || 'v0.1.0').replace(/^v/, '')
  document.querySelector('#hero-version').textContent = `Versão ${version}`
}

function detectPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent
  const normalized = platform.toLowerCase()
  if (normalized.includes('mac')) return 'mac'
  if (normalized.includes('win')) return 'win'
  if (normalized.includes('linux')) return 'linux'
  return null
}

function highlightRecommendedPlatform() {
  const platform = detectPlatform()
  const copy = document.querySelector('#recommended-copy')

  if (!platform) {
    copy.textContent = 'Instaladores disponíveis para os principais sistemas desktop.'
    return
  }

  document.querySelector(`[data-platform="${platform}"]`)?.classList.add('recommended')
  const names = { mac: 'macOS', win: 'Windows', linux: 'Linux' }
  copy.textContent = `${names[platform]} detectado. Escolha o formato ideal abaixo.`
}

async function loadReleases() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases?per_page=10`, {
      headers: { Accept: 'application/vnd.github+json' }
    })

    if (!response.ok) throw new Error(`GitHub respondeu ${response.status}`)

    const releases = (await response.json()).filter((release) => !release.draft && !release.prerelease)
    if (!releases.length) throw new Error('Nenhum release público encontrado')

    renderReleases(releases)
    configureDownloads(releases[0])
  } catch (error) {
    console.info('Usando conteúdo local da landing:', error)
    renderReleases([fallbackRelease], true)
    configureDownloads(fallbackRelease)
  }
}

function configureMenu() {
  const button = document.querySelector('.menu-button')
  const nav = document.querySelector('#site-nav')

  button.addEventListener('click', () => {
    const open = nav.classList.toggle('open')
    button.setAttribute('aria-expanded', String(open))
  })

  nav.addEventListener('click', () => {
    nav.classList.remove('open')
    button.setAttribute('aria-expanded', 'false')
  })
}

configureLinks()
configureMenu()
highlightRecommendedPlatform()
document.querySelector('#year').textContent = new Date().getFullYear()
loadReleases()

