export type SystemFontEntry = {
  family: string
  styles: string[]
}

type FontData = {
  family: string
  fullName: string
  postscriptName: string
  style: string
}

type LocalFontWindow = Window & {
  queryLocalFonts?: () => Promise<FontData[]>
}

function fontWindow(): LocalFontWindow {
  return window as LocalFontWindow
}

let cachedFamilies: SystemFontEntry[] | null = null

export function supportsLocalFontAccess(): boolean {
  return typeof window !== 'undefined' && typeof fontWindow().queryLocalFonts === 'function'
}

/** 读取本机已安装字体（需浏览器支持 Local Font Access API） */
export async function loadSystemFonts(): Promise<SystemFontEntry[]> {
  if (cachedFamilies) return cachedFamilies
  if (!supportsLocalFontAccess()) return []

  const data = await fontWindow().queryLocalFonts!()
  const byFamily = new Map<string, Set<string>>()
  for (const font of data) {
    const family = font.family?.trim()
    if (!family) continue
    const styles = byFamily.get(family) ?? new Set<string>()
    const styleLabel = font.style?.trim() || font.fullName?.trim() || 'Regular'
    styles.add(styleLabel)
    byFamily.set(family, styles)
  }

  cachedFamilies = [...byFamily.entries()]
    .map(([family, styles]) => ({
      family,
      styles: [...styles].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.family.localeCompare(b.family, undefined, { sensitivity: 'base' }))

  return cachedFamilies
}

export function filterSystemFonts(
  fonts: SystemFontEntry[],
  query: string,
): SystemFontEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return fonts
  return fonts.filter(
    (f) =>
      f.family.toLowerCase().includes(q) ||
      f.styles.some((s) => s.toLowerCase().includes(q)),
  )
}

export function systemFontId(family: string): string {
  return `sys:${encodeURIComponent(family)}`
}

export function decodeSystemFontId(id: string): string | null {
  if (!id.startsWith('sys:')) return null
  try {
    return decodeURIComponent(id.slice(4))
  } catch {
    return null
  }
}

export function isSystemFontId(id: string): boolean {
  return id.startsWith('sys:') && Boolean(decodeSystemFontId(id))
}

export function cssFamilyFromSystemName(family: string): string {
  const escaped = family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}", sans-serif`
}
