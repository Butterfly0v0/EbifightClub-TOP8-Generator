export type ImportedFont = {
  id: string
  displayName: string
  /** CSS @font-face family — internal, collision-safe */
  faceFamily: string
  src: string
  format: 'truetype' | 'opentype' | 'woff' | 'woff2'
}

const STORAGE_KEY = 'ebifc-imported-fonts'
const MAX_FONT_BYTES = 5 * 1024 * 1024

const importedById = new Map<string, ImportedFont>()
const registered = new Set<string>()

function formatFromFile(file: File): ImportedFont['format'] | null {
  const ext = file.name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ttf':
      return 'truetype'
    case 'otf':
      return 'opentype'
    case 'woff':
      return 'woff'
    case 'woff2':
      return 'woff2'
    default:
      return null
  }
}

function formatFromMime(mime: string): ImportedFont['format'] | null {
  if (mime.includes('woff2')) return 'woff2'
  if (mime.includes('woff')) return 'woff'
  if (mime.includes('otf') || mime.includes('opentype')) return 'opentype'
  if (mime.includes('ttf') || mime.includes('truetype')) return 'truetype'
  return null
}

function displayNameFromFile(file: File): string {
  return file.name.replace(/\.(ttf|otf|woff2?)$/i, '').trim() || file.name
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取字体文件失败'))
    reader.readAsDataURL(file)
  })
}

function persistImportedFonts(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...importedById.values()]))
  } catch {
    /* quota */
  }
}

export function registerImportedFontFace(font: ImportedFont): void {
  if (registered.has(font.id)) return
  registered.add(font.id)
  const style = document.createElement('style')
  style.dataset.fontId = font.id
  style.textContent = `@font-face{font-family:'${font.faceFamily}';src:url('${font.src.replace(/'/g, "\\'")}') format('${font.format}');font-display:swap;}`
  document.head.appendChild(style)
}

export function getImportedFont(id: string): ImportedFont | undefined {
  return importedById.get(id)
}

export function listImportedFonts(): ImportedFont[] {
  return [...importedById.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function isImportedFontId(id: string): boolean {
  return id.startsWith('file:') && importedById.has(id)
}

export function initImportedFonts(): void {
  importedById.clear()
  registered.clear()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const o = item as Partial<ImportedFont>
      if (
        typeof o.id !== 'string' ||
        !o.id.startsWith('file:') ||
        typeof o.displayName !== 'string' ||
        typeof o.faceFamily !== 'string' ||
        typeof o.src !== 'string' ||
        (o.format !== 'truetype' &&
          o.format !== 'opentype' &&
          o.format !== 'woff' &&
          o.format !== 'woff2')
      ) {
        continue
      }
      importedById.set(o.id, o as ImportedFont)
      registerImportedFontFace(o as ImportedFont)
    }
  } catch {
    /* ignore corrupt storage */
  }
}

export async function importFontFile(file: File): Promise<ImportedFont> {
  if (file.size > MAX_FONT_BYTES) {
    throw new Error(`字体文件过大（最大 ${Math.round(MAX_FONT_BYTES / 1024 / 1024)}MB）`)
  }
  const format = formatFromFile(file)
  if (!format) {
    throw new Error('仅支持 .ttf、.otf、.woff、.woff2 字体文件')
  }
  const dataUrl = await readFileAsDataUrl(file)
  const mimeFormat = formatFromMime(dataUrl.slice(0, dataUrl.indexOf(',')))
  const id = `file:${crypto.randomUUID()}`
  const faceFamily = `EbifcFont-${id.slice(5).replace(/-/g, '')}`
  const font: ImportedFont = {
    id,
    displayName: displayNameFromFile(file),
    faceFamily,
    src: dataUrl,
    format: mimeFormat ?? format,
  }
  importedById.set(id, font)
  registerImportedFontFace(font)
  persistImportedFonts()
  return font
}

export function removeImportedFont(id: string): void {
  if (!importedById.has(id)) return
  importedById.delete(id)
  registered.delete(id)
  document.querySelector(`style[data-font-id="${id}"]`)?.remove()
  persistImportedFonts()
}
