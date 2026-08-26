import { assignTop8Slots, type ImportedPlayer, type TournamentImport } from './importTypes'
import { getStartggToken } from './importTokens'

export { getStartggToken, setStartggToken } from './importTokens'
export type { ImportedPlayer } from './importTypes'

export function parseEventSlug(input: string): string {
  const raw = input.trim()
  const match = raw.match(/tournament\/[^/?#]+\/event\/[^/?#]+/i)
  if (match) return match[0].replace(/\/+$/, '')
  if (raw.startsWith('tournament/')) return raw.replace(/\/+$/, '')
  throw new Error('请粘贴 start.gg 赛事链接，例如 https://www.start.gg/tournament/.../event/...')
}

const STANDINGS_QUERY = `
query Top8Standings($slug: String!) {
  event(slug: $slug) {
    name
    numEntrants
    startAt
    videogame { id name }
    tournament { name city }
    standings(query: { page: 1, perPage: 24, sortBy: "placement" }) {
      nodes {
        placement
        entrant {
          id
          name
          participants {
            gamerTag
            prefix
          }
        }
      }
    }
  }
}
`

const STANDINGS_FALLBACK_QUERY = `
query Top8StandingsFallback($slug: String!) {
  event(slug: $slug) {
    name
    numEntrants
    startAt
    videogame { id name }
    tournament { name city }
    standings(query: { page: 1, perPage: 24 }) {
      nodes {
        placement
        entrant {
          id
          name
          participants {
            gamerTag
            prefix
          }
        }
      }
    }
  }
}
`

const SETS_FALLBACK_QUERY = `
query Top8SetsFallback($slug: String!) {
  event(slug: $slug) {
    sets(page: 1, perPage: 80, sortType: RECENT) {
      nodes {
        games {
          selections {
            character { name }
            entrant { id }
          }
        }
      }
    }
  }
}
`

const SETS_QUERY = `
query Top8Sets($slug: String!, $ids: [ID]!) {
  event(slug: $slug) {
    sets(page: 1, perPage: 50, sortType: RECENT, filters: { entrantIds: $ids }) {
      nodes {
        games {
          selections {
            character { name }
            entrant { id }
          }
        }
      }
    }
  }
}
`

type StandingNode = {
  placement: number
  entrant: {
    id: number | string
    name: string
    participants: Array<{ gamerTag: string; prefix: string | null }>
  } | null
}

type GqlStandings = {
  name: string
  numEntrants: number | null
  startAt: number | null
  videogame: { id: number; name: string } | null
  tournament: { name: string; city: string | null } | null
  standings: { nodes: StandingNode[] } | null
}

type GqlSets = {
  sets: {
    nodes: Array<{
      games: Array<{
        selections: Array<{
          character: { name: string } | null
          entrant: { id: number | string } | null
        }> | null
      }> | null
    }> | null
  } | null
}
export type StartggImport = TournamentImport

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = getStartggToken()
  const res = await fetch('/api/startgg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`start.gg 请求失败（${res.status}）`)
  const body = (await res.json()) as {
    data?: Record<string, T | null>
    errors?: Array<{ message: string }>
  }
  if (body.errors?.length) throw new Error(body.errors[0].message)
  const event = body.data?.event
  if (!event) throw new Error('找不到该赛事，请检查链接或 API Token')
  return event
}

function emptyPlayers(): ImportedPlayer[] {
  return assignTop8Slots([])
}

/** 保留 start.gg 原始名次（双败 1,2,3,4,5,5,7,7；单败 1,2,3,3,5,5,5,5）。 */
function assignStandings(nodes: StandingNode[]): {
  players: ImportedPlayer[]
  ids: Map<number, string>
} {
  const players = emptyPlayers()
  const ids = new Map<number, string>()
  const ranked = nodes
    .filter((n) => n.entrant && n.placement >= 1 && n.placement <= 8)
    .sort(
      (a, b) =>
        a.placement - b.placement ||
        String(a.entrant?.id ?? '').localeCompare(String(b.entrant?.id ?? '')),
    )

  ranked.slice(0, 8).forEach((node, index) => {
    if (!node.entrant) return
    const p = node.entrant.participants[0]
    players[index] = {
      placement: node.placement,
      tag: p?.gamerTag || node.entrant.name,
      prefix: p?.prefix ?? '',
      characterNames: [],
    }
    ids.set(index, String(node.entrant.id))
  })
  return { players, ids }
}

function collectCharacters(
  sets: GqlSets['sets'],
  allowedIds: Set<string>,
): Map<string, string[]> {
  const charCount = new Map<string, Map<string, number>>()
  for (const set of sets?.nodes ?? []) {
    for (const game of set?.games ?? []) {
      for (const sel of game?.selections ?? []) {
        const eid = sel?.entrant?.id == null ? '' : String(sel.entrant.id)
        const cname = sel?.character?.name
        if (!eid || !cname) continue
        if (!allowedIds.has(eid)) continue
        const bag = charCount.get(eid) ?? new Map<string, number>()
        bag.set(cname, (bag.get(cname) ?? 0) + 1)
        charCount.set(eid, bag)
      }
    }
  }
  const ranked = new Map<string, string[]>()
  for (const [id, bag] of charCount) {
    ranked.set(
      id,
      [...bag.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 3),
    )
  }
  return ranked
}

export async function importStartggTop8(slugOrUrl: string): Promise<TournamentImport> {
  const slug = parseEventSlug(slugOrUrl)
  let event: GqlStandings
  try {
    event = await gql<GqlStandings>(STANDINGS_QUERY, { slug })
  } catch {
    event = await gql<GqlStandings>(STANDINGS_FALLBACK_QUERY, { slug })
  }

  const rawNodes = event.standings?.nodes ?? []
  const { players, ids: idBySlot } = assignStandings(rawNodes)

  const ids = [...new Set(idBySlot.values())]
  if (ids.length) {
    try {
      let setEvent: GqlSets
      try {
        setEvent = await gql<GqlSets>(SETS_QUERY, { slug, ids })
      } catch {
        setEvent = await gql<GqlSets>(SETS_FALLBACK_QUERY, { slug })
      }
      const chars = collectCharacters(setEvent.sets, new Set(ids.map(String)))
      for (const [slot, eid] of idBySlot) {
        const names = chars.get(eid)
        if (names?.length) players[slot].characterNames = names
      }
    } catch {
      // 角色是附加信息，名次导入失败才算失败
    }
  }

  const date = event.startAt
    ? new Date(event.startAt * 1000).toISOString().slice(0, 10)
    : ''

  return {
    source: 'startgg',
    tournamentName: event.tournament?.name ?? event.name,
    eventName: event.name,
    date,
    videogameName: event.videogame?.name ?? '',
    numEntrants: event.numEntrants,
    players,
  }
}

/** @deprecated 使用 importStartggTop8 */
export const importTop8 = importStartggTop8
