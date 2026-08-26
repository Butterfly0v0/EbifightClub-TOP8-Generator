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

const loaded = new Set<string>()

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

export function ensureFontLoaded(id: string | undefined): void {
  if (!id) return
  const preset = FONT_MAP[id]
  if (preset?.google) {
    if (loaded.has(preset.id)) return
    loaded.add(preset.id)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${preset.google}&display=swap`
    document.head.appendChild(link)
    return
  }
  const imported = getImportedFont(id)
  if (imported) {
    registerImportedFontFace(imported)
  }
}

export function ensureFontsLoaded(...ids: (string | undefined)[]): void {
  for (const id of ids) ensureFontLoaded(id)
}

export const DEFAULT_TITLE_FONT = 'noto-sans'
export const DEFAULT_PLAYER_FONT = 'noto-sans'
export const DEFAULT_RANK_FONT = 'bebas'
