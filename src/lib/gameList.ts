import { FEATURED_GAMES } from './assets'
import type { Catalog, GameMeta } from '../types'

export function listGamesFromCatalog(catalog: Catalog): GameMeta[] {
  const featured = FEATURED_GAMES.map((c) => catalog[c]).filter(
    (g): g is GameMeta => Boolean(g),
  )
  const rest = Object.values(catalog)
    .filter((g) => !FEATURED_GAMES.includes(g.code))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...featured, ...rest]
}

export function filterGames(games: GameMeta[], query: string): GameMeta[] {
  const q = query.trim().toLowerCase()
  if (!q) return games
  return games.filter(
    (g) =>
      g.name.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      g.packs.some((p) => p.name.toLowerCase().includes(q)),
  )
}
