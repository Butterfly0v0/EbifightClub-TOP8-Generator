import {
  getImportedFont,
  initImportedFonts,
  isImportedFontId,
  listImportedFonts,
  registerImportedFontFace,
  type ImportedFont,
} from './customFonts'
import {
  cssFamilyFromSystemName,
  decodeSystemFontId,
  isSystemFontId,
  systemFontId,
} from './systemFonts'

export type FontPreset = {
  id: string
  name: string
  family: string
  google?: string
}

export const FONT_PRESETS: FontPreset[] = [
  { id: 'noto-sans', name: '思源黑体', family: '"Noto Sans SC", sans-serif', google: 'Noto+Sans+SC:wght@400;600;800' },
  { id: 'bebas', name: 'Bebas Neue', family: '"Bebas Neue", Impact, sans-serif', google: 'Bebas+Neue' },
  { id: 'outfit', name: 'Outfit', family: '"Outfit", sans-serif', google: 'Outfit:wght@400;600;800' },
  { id: 'oswald', name: 'Oswald', family: '"Oswald", sans-serif', google: 'Oswald:wght@400;600;700' },
  { id: 'russo', name: 'Russo One', family: '"Russo One", sans-serif', google: 'Russo+One' },
  { id: 'orbitron', name: 'Orbitron', family: '"Orbitron", sans-serif', google: 'Orbitron:wght@400;700' },
  { id: 'black-ops', name: 'Black Ops One', family: '"Black Ops One", sans-serif', google: 'Black+Ops+One' },
  { id: 'anton', name: 'Anton', family: '"Anton", sans-serif', google: 'Anton' },
  { id: 'teko', name: 'Teko', family: '"Teko", sans-serif', google: 'Teko:wght@400;600;700' },
  { id: 'ma-shan', name: '马善政毛笔', family: '"Ma Shan Zheng", cursive', google: 'Ma+Shan+Zheng' },
  { id: 'zcool', name: '站酷快乐体', family: '"ZCOOL QingKe HuangYou", cursive', google: 'ZCOOL+QingKe+HuangYou' },
  { id: 'press-start', name: 'Press Start 2P', family: '"Press Start 2P", monospace', google: 'Press+Start+2P' },
  { id: 'impact', name: 'Impact', family: 'Impact, "Arial Black", sans-serif' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
]

export const FONT_MAP = Object.fromEntries(FONT_PRESETS.map((f) => [f.id, f])) as Record<
  string,
  FontPreset
>

const stylesheetPromises = new Map<string, Promise<void>>()
const facePromises = new Map<string, Promise<void>>()

const FONT_WAIT_MS = 12000
const FONT_LOAD_SAMPLE =
  'TOP 8 1st 2nd 3rd 4th 5th 6th 7th 8th ABCDEFGHIJKLMNOPQRSTUVWXYZ 赛事选手名'

export { initImportedFonts, listImportedFonts, systemFontId }
export type { ImportedFont }

export function isValidFontId(id: string | undefined): boolean {
  if (!id) return false
  if (FONT_MAP[id]) return true
  if (isSystemFontId(id)) return true
  if (isImportedFontId(id)) return true
  return false
}

export function fontLabel(id: string | undefined, fallback = 'noto-sans'): string {
  if (!id) return FONT_MAP[fallback]?.name ?? fallback
  const preset = FONT_MAP[id]
  if (preset) return preset.name
  const imported = getImportedFont(id)
  if (imported) return imported.displayName
  if (id.startsWith('file:')) return '（缺失的导入字体）'
  const systemFamily = decodeSystemFontId(id)
  if (systemFamily) return systemFamily
  return FONT_MAP[fallback]?.name ?? fallback
}

export function fontFamily(id: string | undefined, fallback = 'noto-sans'): string {
  if (!id) return FONT_MAP[fallback]?.family ?? FONT_MAP[fallback].family
  const preset = FONT_MAP[id]
  if (preset) return preset.family
  const imported = getImportedFont(id)
  if (imported) return `"${imported.faceFamily}", sans-serif`
  const systemFamily = decodeSystemFontId(id)
  if (systemFamily) return cssFamilyFromSystemName(systemFamily)
  return FONT_MAP[fallback]?.family ?? FONT_MAP[fallback].family
}

function primaryFamilyName(cssFamily: string): string {
  const first = cssFamily.split(',')[0]?.trim() ?? cssFamily
  return first.replace(/^["']|["']$/g, '')
}

function googleWeights(preset: FontPreset): number[] {
  const match = preset.google?.match(/wght@([0-9;]+)/)
  if (match) {
    return match[1]
      .split(';')
      .map((w) => Number(w))
      .filter((n) => Number.isFinite(n) && n > 0)
  }
  return [400]
}

/** CSS font shorthand for canvas, using a weight the face actually ships. */
export function canvasFont(
  size: number,
  fontId: string | undefined,
  weight = '700',
  fallback = 'noto-sans',
  extra = '',
): string {
  const w = resolveFontWeight(fontId, weight, fallback)
  const family = fontFamily(fontId, fallback)
  const prefix = extra.trim() ? `${extra.trim()} ` : ''
  return `${prefix}${w} ${size}px ${family}`
}

/** Map a requested weight onto one the face actually ships (e.g. Press Start 2P is 400 only). */
export function resolveFontWeight(id: string | undefined, requested: string, fallbackId = 'noto-sans'): string {
  const n = Number.parseInt(requested, 10)
  if (!Number.isFinite(n)) return requested
  const preset = id ? FONT_MAP[id] : FONT_MAP[fallbackId]
  if (!preset?.google) return requested
  const available = googleWeights(preset)
  if (available.length === 0) return requested
  let best = available[0]
  for (const w of available) {
    if (Math.abs(w - n) < Math.abs(best - n)) best = w
  }
  return String(best)
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(), ms)
    promise.then(
      () => {
        window.clearTimeout(timer)
        resolve()
      },
      () => {
        window.clearTimeout(timer)
        resolve()
      },
    )
  })
}

function waitForStylesheet(link: HTMLLinkElement): Promise<void> {
  if (link.sheet || link.dataset.fontReady === '1') return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      link.dataset.fontReady = '1'
      resolve()
    }
    link.addEventListener('load', done, { once: true })
    link.addEventListener('error', done, { once: true })
    if (link.sheet) {
      done()
      return
    }
    window.setTimeout(done, FONT_WAIT_MS)
  })
}

function waitForExistingGoogleStylesheets(): Promise<void> {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].filter((el) => {
    const href = (el as HTMLLinkElement).href
    return href.includes('fonts.googleapis.com') || href.includes('fonts.gstatic.com')
  }) as HTMLLinkElement[]
  return Promise.all(links.map(waitForStylesheet)).then(() => undefined)
}

function injectGoogleStylesheet(preset: FontPreset): Promise<void> {
  if (!preset.google) return Promise.resolve()
  const cached = stylesheetPromises.get(preset.id)
  if (cached) return cached

  const href = `https://fonts.googleapis.com/css2?family=${preset.google}&display=swap`
  const promise = (async () => {
    const existing =
      (document.querySelector(`link[data-google-font="${preset.id}"]`) as HTMLLinkElement | null) ??
      (document.querySelector(`link[href="${href}"]`) as HTMLLinkElement | null)
    if (existing) {
      existing.dataset.googleFont = preset.id
      await waitForStylesheet(existing)
      return
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.googleFont = preset.id
    document.head.appendChild(link)
    await waitForStylesheet(link)
  })()

  stylesheetPromises.set(preset.id, promise)
  return promise
}

async function loadFacesForFamily(cssFamily: string, weights: number[], sampleText: string): Promise<void> {
  const family = primaryFamilyName(cssFamily)
  if (!family || typeof document === 'undefined' || !document.fonts) return
  const quoted = family.includes(' ') ? `"${family}"` : family
  await Promise.all(
    weights.map((w) =>
      document.fonts.load(`${w} 64px ${quoted}`, sampleText).then(
        () => undefined,
        () => undefined,
      ),
    ),
  )
}

function loadFontFaces(id: string | undefined, sampleText = FONT_LOAD_SAMPLE): Promise<void> {
  if (!id) return Promise.resolve()
  const key = `${id}\0${sampleText}`
  const cached = facePromises.get(key)
  if (cached) return cached

  const run = (async () => {
    const preset = FONT_MAP[id]
    if (preset?.google) {
      await waitForExistingGoogleStylesheets()
      const family = primaryFamilyName(preset.family)
      const quoted = family.includes(' ') ? `"${family}"` : family
      const alreadyOnPage = googleWeights(preset).some((w) => {
        try {
          return document.fonts.check(`${w} 16px ${quoted}`)
        } catch {
          return false
        }
      })
      if (!alreadyOnPage) await injectGoogleStylesheet(preset)
      await loadFacesForFamily(preset.family, googleWeights(preset), sampleText)
      return
    }
    const imported = getImportedFont(id)
    if (imported) {
      registerImportedFontFace(imported)
      await loadFacesForFamily(`"${imported.faceFamily}"`, [400, 700], sampleText)
    }
  })()

  facePromises.set(key, withTimeout(run, FONT_WAIT_MS))
  return facePromises.get(key)!
}

export function ensureFontLoaded(id: string | undefined): void {
  void loadFontFaces(id)
}

export function ensureFontsLoaded(...ids: (string | undefined)[]): void {
  for (const id of ids) ensureFontLoaded(id)
}

/**
 * Wait until Google / imported faces are actually usable on canvas.
 * `document.fonts.ready` is not enough: it does not wait for stylesheets injected after first paint.
 */
export async function waitForFonts(
  ids: (string | undefined)[],
  sampleText = '',
): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  const text = `${FONT_LOAD_SAMPLE} ${sampleText}`.trim()
  await Promise.all(unique.map((id) => loadFontFaces(id, text)))
  if (typeof document === 'undefined' || !document.createElement) return
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return
  for (const id of unique) {
    ctx.font = canvasFont(64, id, '400')
    ctx.fillText('TOP 8', 0, 64)
    ctx.font = canvasFont(64, id, '700')
    ctx.fillText('TOP 8', 0, 64)
  }
}

export const DEFAULT_TITLE_FONT = 'noto-sans'
export const DEFAULT_PLAYER_FONT = 'noto-sans'
export const DEFAULT_RANK_FONT = 'bebas'
