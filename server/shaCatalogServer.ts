import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Catalog, CharacterDef, GameMeta, PackMeta } from '../src/types.ts'

const CACHE_DIR = path.resolve('.sha-cache')
const SHA_BASES = [
  'https://cdn.jsdelivr.net/gh/joaorb64/StreamHelperAssets@master/',
  'https://raw.githubusercontent.com/joaorb64/StreamHelperAssets/master/',
]

const SKIP_PACKS = new Set([
  'css',
  'logo',
  'stage_icon',
  'variant_icon',
  'badge',
  'badge_alt',
  'support',
])

type AssetsJson = Record<
  string,
  {
    name: string
    assets: Record<string, { name: string; description?: string }>
  }
>

function cachePath(rel: string): string {
  const safe = rel.replace(/^\/+/, '').replace(/\\/g, '/')
  if (safe.includes('..')) throw new Error('invalid cache path')
  return path.join(CACHE_DIR, ...safe.split('/'))
}

async function fetchBuffer(rel: string): Promise<Buffer> {
  const nested = cachePath(rel)
  if (existsSync(nested)) return readFileSync(nested)

  let lastErr: unknown
  for (const base of SHA_BASES) {
    try {
      const res = await fetch(`${base}${rel}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) continue
      const body = Buffer.from(await res.arrayBuffer())
      mkdirSync(path.dirname(nested), { recursive: true })
      writeFileSync(nested, body)
      return body
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`无法下载素材：${rel}`)
}

function packPath(gameCode: string, packId: string): string {
  if (packId === 'icon') return `games/${gameCode}/base_files/icon`
  return `games/${gameCode}/${packId}`
}

export async function loadCatalogServer(): Promise<Catalog> {
  const raw = await fetchBuffer('assets.json')
  const json = JSON.parse(raw.toString('utf8')) as AssetsJson
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

export async function loadGameCharactersServer(gameCode: string): Promise<CharacterDef[]> {
  const raw = await fetchBuffer(`games/${gameCode}/base_files/config.json`)
  const json = JSON.parse(raw.toString('utf8')) as {
    character_to_codename?: Record<string, { codename?: string; smashgg_name?: string }>
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
}

export async function resolveGameMeta(gameCode: string): Promise<GameMeta> {
  const catalog = await loadCatalogServer()
  const game = catalog[gameCode]
  if (!game) throw new Error(`未知游戏：${gameCode}`)
  return game
}
