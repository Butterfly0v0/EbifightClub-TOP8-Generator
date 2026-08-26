import { readImageFile } from './imageFile'

export function isUserAssetPath(src: string): boolean {
  return src.startsWith('/user-assets/')
}

export function isBrandAssetPath(src: string): boolean {
  return src.startsWith('/brand/')
}

export function isImageSrc(src: string): boolean {
  return Boolean(src) && (src.startsWith('data:') || isUserAssetPath(src) || isBrandAssetPath(src))
}

type SaveImageOpts = {
  maxEdge?: number
  quality?: number
  mime?: string
  prefix?: string
  /** 游戏代号，决定保存到 public/user-assets/{gameCode}/ */
  gameCode?: string
}

/** 上传图片到 public/user-assets/{gameCode}/；失败时回退为 data URL */
export async function saveUserImage(
  file: File,
  opts: SaveImageOpts = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 1920
  const quality = opts.quality ?? 0.86
  const mime = opts.mime ?? 'image/jpeg'
  const dataUrl = await readImageFile(file, { maxEdge, quality, mime })

  try {
    const res = await fetch('/api/user-assets/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: dataUrl,
        mime,
        prefix: opts.prefix ?? 'asset',
        gameCode: opts.gameCode ?? 'shared',
      }),
    })
    if (res.ok) {
      const body = (await res.json()) as { url?: string }
      if (body.url) return body.url
    }
  } catch {
    // dev server unavailable — keep data URL
  }

  return dataUrl
}

export async function saveUserImageFromDataUrl(
  dataUrl: string,
  opts: { mime?: string; prefix?: string; gameCode?: string } = {},
): Promise<string> {
  if (isUserAssetPath(dataUrl)) return dataUrl
  if (!dataUrl.startsWith('data:')) return dataUrl

  try {
    const res = await fetch('/api/user-assets/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: dataUrl,
        mime: opts.mime ?? 'image/jpeg',
        prefix: opts.prefix ?? 'asset',
        gameCode: opts.gameCode ?? 'shared',
      }),
    })
    if (res.ok) {
      const body = (await res.json()) as { url?: string }
      if (body.url) return body.url
    }
  } catch {
    // fallback below
  }

  return dataUrl
}
