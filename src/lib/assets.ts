import type { Catalog, CharacterDef, GameMeta, PackConfig, PackMeta } from '../types'

export function assetUrl(path: string): string {
  return `/api/sha/${path.replace(/^\//, '')}`
}

type AssetsJson = Record<
  string,
  {
    name: string
    assets: Record<
      string,
      {
        name: string
        description?: string
      }
    >
  }
>

const SKIP_PACKS = new Set([
  'css',
  'logo',
  'stage_icon',
  'variant_icon',
  'badge',
  'badge_alt',
  'support',
])

const characterListCache = new Map<string, Promise<CharacterDef[]>>()
const packConfigCache = new Map<string, Promise<PackConfig>>()

function packPath(gameCode: string, packId: string): string {
  if (packId === 'icon') return `games/${gameCode}/base_files/icon`
  return `games/${gameCode}/${packId}`
}

export async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch(assetUrl('assets.json'))
  if (!res.ok) throw new Error(`加载素材目录失败（${res.status}）`)
  const json = (await res.json()) as AssetsJson
  const catalog: Catalog = {}

  for (const [code, game] of Object.entries(json)) {
    const packs: PackMeta[] = []
    for (const [id, pack] of Object.entries(game.assets ?? {})) {
      if (id === 'base_files') {
        packs.push({
          id: 'icon',
          name: 'Icons / Portraits (base)',
          path: packPath(code, 'icon'),
          description: pack.description ?? '',
        })
        continue
      }
      if (SKIP_PACKS.has(id)) continue
      packs.push({
        id,
        name: pack.name || id,
        path: packPath(code, id),
        description: pack.description ?? '',
      })
    }
    packs.sort((a, b) => {
      const rank = (id: string) =>
        id === 'full' ? 0 : id === 'icon' ? 1 : id === 'art' ? 2 : 10
      return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name)
    })
    catalog[code] = { code, name: game.name, packs }
  }
  return catalog
}

export async function fetchGameCharacters(gameCode: string): Promise<CharacterDef[]> {
  const hit = characterListCache.get(gameCode)
  if (hit) return hit
  const promise = (async () => {
    const res = await fetch(assetUrl(`games/${gameCode}/base_files/config.json`))
    if (!res.ok) throw new Error(`加载游戏配置失败（${res.status}）`)
    const json = (await res.json()) as {
      character_to_codename?: Record<
        string,
        { codename?: string; smashgg_name?: string }
      >
    }
    const list: CharacterDef[] = []
    for (const [name, info] of Object.entries(json.character_to_codename ?? {})) {
      if (!info.codename) continue
      list.push({
        name,
        codename: info.codename,
        smashggName: info.smashgg_name ?? name,
      })
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  })()
  characterListCache.set(gameCode, promise)
  promise.catch(() => characterListCache.delete(gameCode))
  return promise
}

export async function fetchPackConfig(game: GameMeta, packId: string): Promise<PackConfig> {
  const cacheKey = `${game.code}:${packId}`
  const hit = packConfigCache.get(cacheKey)
  if (hit) return hit
  const promise = (async () => {
    const pack = game.packs.find((p) => p.id === packId) ?? game.packs[0]
    if (!pack) throw new Error('该游戏没有可用素材包')
    const res = await fetch(assetUrl(`${pack.path}/config.json`))
    if (!res.ok) throw new Error(`加载素材包失败（${res.status}）`)
    const json = (await res.json()) as PackConfig
    return {
      name: json.name ?? pack.name,
      prefix: json.prefix ?? '',
      postfix: json.postfix ?? '',
      type: json.type,
      eyesights: json.eyesights,
      image_sizes: json.image_sizes,
      skin_mapping: json.skin_mapping,
    }
  })()
  packConfigCache.set(cacheKey, promise)
  promise.catch(() => packConfigCache.delete(cacheKey))
  return promise
}

export function characterFileName(
  pack: PackConfig,
  codename: string,
  skin: number,
): string {
  const mapped = pack.skin_mapping?.[codename]?.[String(skin)]
  const n = mapped ?? skin
  return `${pack.prefix}${codename}${pack.postfix}${n}.png`
}

export function characterUrl(
  game: GameMeta,
  packId: string,
  pack: PackConfig,
  codename: string,
  skin: number,
): string {
  const packMeta = game.packs.find((p) => p.id === packId)
  const path = packMeta?.path ?? packPath(game.code, packId)
  return assetUrl(`${path}/${characterFileName(pack, codename, skin)}`)
}

export function gameLogoUrl(gameCode: string): string {
  return assetUrl(`games/${gameCode}/base_files/logo.png`)
}

export function skinCount(pack: PackConfig, codename: string): number {
  const sizes = pack.image_sizes?.[codename]
  if (!sizes) return 1
  return Object.keys(sizes).length
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(url: string): Promise<HTMLImageElement> {
  const hit = imageCache.get(url)
  if (hit) return hit
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => {
      imageCache.delete(url)
      reject(new Error(`图片加载失败: ${url}`))
    }
    img.src = url
  })
  imageCache.set(url, promise)
  return promise
}

export function matchCharacter(
  characters: CharacterDef[],
  smashggName: string,
): CharacterDef | undefined {
  const n = smashggName.trim().toLowerCase()
  return (
    characters.find((c) => c.smashggName.toLowerCase() === n) ??
    characters.find((c) => c.name.toLowerCase() === n) ??
    characters.find((c) => c.codename.toLowerCase() === n)
  )
}

export function matchGame(catalog: Catalog, smashggName: string): GameMeta | undefined {
  const n = smashggName.trim().toLowerCase()
  const games = Object.values(catalog)
  return (
    games.find((g) => g.name.toLowerCase() === n) ??
    games.find((g) => g.name.toLowerCase().includes(n) || n.includes(g.name.toLowerCase()))
  )
}

export const FEATURED_GAMES = ['sf6', 'ggst', 'tekken8', 'gbvsr', 'riotpl', 'ssbu', 'sfv', 'kofxv']

export function packImagePaths(
  game: GameMeta,
  packId: string,
  pack: PackConfig,
  characters: CharacterDef[],
): string[] {
  const packMeta = game.packs.find((p) => p.id === packId)
  const base = packMeta?.path ?? packPath(game.code, packId)
  const codes = pack.image_sizes
    ? Object.keys(pack.image_sizes)
    : characters.map((c) => c.codename)
  const extra = ['logo.png', 'logo_small.png'].map((f) => `games/${game.code}/base_files/${f}`)
  return [
    `${base}/config.json`,
    `games/${game.code}/base_files/config.json`,
    ...extra,
    ...codes.map((code) => `${base}/${characterFileName(pack, code, 0)}`),
  ]
}

export async function prefetchPaths(
  paths: string[],
  onProgress: (done: number, total: number) => void,
  concurrency = 8,
): Promise<void> {
  let done = 0
  const total = paths.length
  const queue = [...paths]
  let lastReportAt = 0
  let lastReported = -1

  const report = (force = false) => {
    const now = Date.now()
    if (
      !force &&
      done !== total &&
      done - lastReported < 8 &&
      now - lastReportAt < 120
    ) {
      return
    }
    lastReported = done
    lastReportAt = now
    onProgress(done, total)
  }

  report(true)

  async function worker() {
    while (queue.length) {
      const rel = queue.shift()
      if (!rel) break
      try {
        // Warm HTTP/disk cache only — avoid decoding every PNG into imageCache
        await fetch(assetUrl(rel), { cache: 'force-cache' })
      } catch {
        // keep going; missing files are fine
      }
      done += 1
      report()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) || 1 }, () => worker()))
  report(true)
}
