const REPOSITORY = 'lucas3322/postblack'
const GITHUB_URL = `https://github.com/${REPOSITORY}`
const RELEASES_URL = `${GITHUB_URL}/releases`

const fallbackRelease = {
  tag_name: 'v0.15.0',
  name: 'Postblack 0.15.0',
  published_at: '2026-09-20T00:00:00Z',
  html_url: RELEASES_URL,
  body: [
    'Busca de texto no corpo da resposta',
    'Expansão da barra lateral persistida entre sessões',
    'Importação e exportação de cURL com multipart/form-data e GraphQL',
    'Variáveis globais, de workspace e de ambiente com autocomplete'
  ].join('\n'),
  assets: []
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))

function configureLinks() {
  $$('[data-github-link]').forEach((link) => {
    link.href = GITHUB_URL
  })
  $$('[data-releases-link]').forEach((link) => {
    link.href = RELEASES_URL
  })
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function notesFromBody(body) {
  return (body || '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/^#+\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/^(feat|fix|perf|refactor|docs|chore|style|test|build|ci)(\([^)]*\))?!?:\s*/i, '')
        .trim()
    )
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1))
    .filter((line) => line && !/^changelog$/i.test(line) && !/^(features|bug fixes)$/i.test(line))
    .slice(0, 4)
}

function appendNote(list, note) {
  const item = document.createElement('li')
  const commitMatch = note.match(/\(\[?([a-f0-9]{7,40})\]?(?:\([^)]*\))?\)$/i)

  if (!commitMatch) {
    item.textContent = note
    list.append(item)
    return
  }

  item.append(document.createTextNode(note.slice(0, commitMatch.index)))
  const commitLink = document.createElement('a')
  commitLink.className = 'commit-link'
  commitLink.href = `${GITHUB_URL}/commit/${commitMatch[1]}`
  commitLink.textContent = commitMatch[1].slice(0, 7)
  commitLink.target = '_blank'
  commitLink.rel = 'noreferrer'
  item.append(commitLink)
  list.append(item)
}

function renderReleases(releases, isFallback = false) {
  const feed = $('#release-feed')
  if (!feed) return
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
    date.dateTime = release.published_at || ''
    date.textContent = formatDate(release.published_at)
    top.append(version, date)

    const title = document.createElement('h3')
    const tag = release.tag_name || ''
    title.textContent =
      release.name && release.name !== tag ? release.name : `Postblack ${tag.replace(/^v/, '')}`.trim()
    const list = document.createElement('ul')
    list.className = 'release-list'
    const notes = notesFromBody(release.body)
    ;(notes.length ? notes : ['Correções e melhorias desta versão.']).forEach((note) => appendNote(list, note))

    card.append(top, title, list)
    feed.append(card)
  })

  feed.setAttribute('aria-busy', 'false')
  const status = $('#feed-status')
  if (status) {
    status.textContent = isFallback
      ? 'Não foi possível consultar o GitHub agora — exibindo as notas locais da última versão.'
      : 'Notas sincronizadas com os GitHub Releases.'
  }
}

function assetMatches(name, key) {
  const normalized = name.toLowerCase()
  const rules = {
    'mac-arm64': normalized.endsWith('-macos.zip') && normalized.includes('arm64'),
    'mac-x64': normalized.endsWith('-macos.zip') && normalized.includes('x64'),
    'win-setup': normalized.endsWith('.exe') && normalized.includes('setup'),
    'win-portable': normalized.endsWith('.exe') && normalized.includes('portable'),
    'linux-appimage': normalized.endsWith('.appimage'),
    'linux-deb': normalized.endsWith('.deb')
  }
  return rules[key]
}

function configureDownloads(release) {
  $$('[data-asset]').forEach((link) => {
    const key = link.dataset.asset
    const asset = release.assets?.find((candidate) => assetMatches(candidate.name, key))
    const macFallback = key.startsWith('mac-')
      ? release.assets?.find((candidate) => {
          const name = candidate.name.toLowerCase()
          const architecture = key === 'mac-arm64' ? 'arm64' : 'x64'
          return name.endsWith('.dmg') && name.includes(architecture)
        })
      : undefined
    const selectedAsset = asset || macFallback
    link.href = selectedAsset?.browser_download_url || release.html_url || RELEASES_URL
    if (selectedAsset) link.setAttribute('download', '')
  })

  const version = (release.tag_name || fallbackRelease.tag_name).replace(/^v/, '')
  const heroVersion = $('#hero-version')
  if (heroVersion) heroVersion.textContent = `Versão ${version}`
}

function detectPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || ''
  const normalized = platform.toLowerCase()
  if (normalized.includes('mac')) return 'mac'
  if (normalized.includes('win')) return 'win'
  if (normalized.includes('linux')) return 'linux'
  return null
}

function highlightRecommendedPlatform() {
  const platform = detectPlatform()
  const copy = $('#recommended-copy')

  if (!platform) {
    if (copy) copy.textContent = 'Instaladores disponíveis para macOS, Windows e Linux.'
    return
  }

  const card = $(`[data-platform="${platform}"]`)
  if (card) {
    card.classList.add('recommended')
    $('.recommended-badge', card)?.removeAttribute('hidden')
  }
  const names = { mac: 'macOS', win: 'Windows', linux: 'Linux' }
  if (copy) copy.textContent = `${names[platform]} detectado. O formato recomendado está em destaque.`
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
  const button = $('.menu-button')
  const nav = $('#site-nav')
  if (!button || !nav) return

  const setOpen = (open) => {
    nav.classList.toggle('open', open)
    button.setAttribute('aria-expanded', String(open))
  }

  button.addEventListener('click', () => setOpen(!nav.classList.contains('open')))
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false)
      button.focus()
    }
  })
  document.addEventListener('click', (event) => {
    if (nav.classList.contains('open') && !nav.contains(event.target) && !button.contains(event.target)) {
      setOpen(false)
    }
  })
}

function configureHeader() {
  const header = $('[data-header]')
  if (!header) return
  let ticking = false
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8)
    ticking = false
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(update)
      }
    },
    { passive: true }
  )
  update()
}

function configureReveal() {
  const items = $$('.reveal')
  if (!items.length || !('IntersectionObserver' in window)) return

  document.documentElement.classList.add('js')

  // Stagger siblings that share a parent so grids cascade gently.
  const groups = new Map()
  items.forEach((item) => {
    const siblings = groups.get(item.parentElement) || []
    siblings.push(item)
    groups.set(item.parentElement, siblings)
  })
  groups.forEach((siblings) => {
    if (siblings.length < 2) return
    siblings.forEach((item, index) => item.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 60}ms`))
  })

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  )
  items.forEach((item) => observer.observe(item))
}

function configureCurlDemo() {
  const demo = $('[data-curl-demo]')
  const text = $('[data-curl-text]', demo || undefined)
  const parsed = $('[data-curl-parsed]', demo || undefined)
  const replay = $('[data-curl-replay]', demo || undefined)
  if (!demo || !text || !parsed) return

  const full = text.textContent
  let timer = null

  const finish = () => {
    window.clearTimeout(timer)
    text.textContent = full
    text.classList.remove('is-typing')
    parsed.classList.remove('is-pending')
    if (replay) replay.hidden = false
  }

  const play = () => {
    if (prefersReducedMotion()) {
      finish()
      return
    }
    window.clearTimeout(timer)
    if (replay) replay.hidden = true
    parsed.classList.add('is-pending')
    text.classList.add('is-typing')
    text.textContent = ''
    let index = 0
    const step = () => {
      // Type in small chunks so the whole command lands in ~2s.
      index = Math.min(full.length, index + 3)
      text.textContent = full.slice(0, index)
      if (index < full.length) {
        timer = window.setTimeout(step, 18)
      } else {
        timer = window.setTimeout(finish, 320)
      }
    }
    timer = window.setTimeout(step, 250)
  }

  replay?.addEventListener('click', play)

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    finish()
    return
  }

  parsed.classList.add('is-pending')
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        play()
      }
    },
    { threshold: 0.4 }
  )
  observer.observe(demo)
}

function configureVizTabs() {
  const tabs = $$('[data-viz-tabs] [data-viz]')
  if (!tabs.length) return

  const select = (tab, focus = false) => {
    tabs.forEach((candidate) => {
      const selected = candidate === tab
      candidate.setAttribute('aria-selected', String(selected))
      candidate.tabIndex = selected ? 0 : -1
      const panel = document.getElementById(candidate.getAttribute('aria-controls'))
      if (panel) panel.hidden = !selected
    })
    if (focus) tab.focus()
  }

  tabs.forEach((tab, index) => {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (event) => {
      const offsets = { ArrowRight: 1, ArrowLeft: -1 }
      if (event.key in offsets) {
        event.preventDefault()
        select(tabs[(index + offsets[event.key] + tabs.length) % tabs.length], true)
      }
    })
  })
}

function configureColorVision() {
  const buttons = $$('[data-cv-tabs] [data-cv]')
  const preview = $('[data-cv-preview]')
  if (!buttons.length || !preview) return

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)))
      preview.dataset.mode = button.dataset.cv
    })
  })
}

function setYear() {
  const year = $('#year')
  if (year) year.textContent = String(new Date().getFullYear())
}

configureLinks()
configureMenu()
configureHeader()
configureReveal()
configureCurlDemo()
configureVizTabs()
configureColorVision()
highlightRecommendedPlatform()
setYear()
loadReleases()
