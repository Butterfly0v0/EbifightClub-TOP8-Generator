import { parseParryStandingsHtml } from '../src/lib/parryParse.ts'
import { assignTop8Slots, type TournamentImport } from '../src/lib/importTypes.ts'
import { detectImportSource } from '../src/lib/tournamentImport.ts'
import { parseEventSlug } from '../src/lib/startgg.ts'
import { parseChallongeSlug } from '../src/lib/challonge.ts'
import { parseParrySlugPath } from '../src/lib/parrygg.ts'

export type ServerImportOptions = {
  startggToken?: string
  challongeApiKey?: string
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
          participants { gamerTag prefix }
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
          participants { gamerTag prefix }
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

async function startggGql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<T> {
  const res = await fetch('https://api.start.gg/gql/alpha', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error(
        `start.gg 请求被拒绝（${res.status}）。请在请求体传 startggToken，或设置环境变量 STARTGG_TOKEN（https://www.start.gg/admin/profile/developer）`,
      )
    }
    throw new Error(`start.gg 请求失败（${res.status}）`)
  }
  const body = (await res.json()) as {
    data?: Record<string, T | null>
    errors?: Array<{ message: string }>
  }
  if (body.errors?.length) throw new Error(body.errors[0].message)
  const event = body.data?.event
  if (!event) throw new Error('找不到该赛事，请检查链接或 start.gg Token')
  return event
}

function assignStandings(nodes: StandingNode[]) {
  const players = assignTop8Slots([])
  const idBySlot = new Map<number, string>()
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
    idBySlot.set(index, String(node.entrant.id))
  })
  return { players, idBySlot }
}

function collectCharacters(sets: GqlSets['sets'], allowedIds: Set<string>) {
  const charCount = new Map<string, Map<string, number>>()
  for (const set of sets?.nodes ?? []) {
    for (const game of set?.games ?? []) {
      for (const sel of game?.selections ?? []) {
        const eid = sel?.entrant?.id == null ? '' : String(sel.entrant.id)
        const cname = sel?.character?.name
        if (!eid || !cname || !allowedIds.has(eid)) continue
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

async function importStartggServer(
  url: string,
  token: string,
): Promise<TournamentImport> {
  const slug = parseEventSlug(url)
  let event: GqlStandings
  try {
    event = await startggGql<GqlStandings>(STANDINGS_QUERY, { slug }, token)
  } catch {
    event = await startggGql<GqlStandings>(STANDINGS_FALLBACK_QUERY, { slug }, token)
  }

  const { players, idBySlot } = assignStandings(event.standings?.nodes ?? [])
  const ids = [...new Set(idBySlot.values())]
  if (ids.length) {
    try {
      let setEvent: GqlSets
      try {
        setEvent = await startggGql<GqlSets>(SETS_QUERY, { slug, ids }, token)
      } catch {
        setEvent = await startggGql<GqlSets>(SETS_FALLBACK_QUERY, { slug }, token)
      }
      const chars = collectCharacters(setEvent.sets, new Set(ids))
      for (const [slot, eid] of idBySlot) {
        const names = chars.get(eid)
        if (names?.length) players[slot].characterNames = names
      }
    } catch {
      // characters optional
    }
  }

  return {
    source: 'startgg',
    tournamentName: event.tournament?.name ?? event.name,
    eventName: event.name,
    date: event.startAt ? new Date(event.startAt * 1000).toISOString().slice(0, 10) : '',
    videogameName: event.videogame?.name ?? '',
    numEntrants: event.numEntrants,
    players,
  }
}

type ChallongeParticipant = {
  id: number
  name: string
  final_rank: number | null
}

type ChallongeTournament = {
  name: string
  participants_count: number
  started_at: string | null
  completed_at: string | null
  game_name?: string | null
  participants?: Array<{ participant: ChallongeParticipant }>
}

function parseTagName(name: string): { tag: string; prefix: string } {
  const trimmed = name.trim()
  if (!trimmed) return { tag: '', prefix: '' }
  const pipe = trimmed.split('|').map((s) => s.trim()).filter(Boolean)
  if (pipe.length >= 2) return { prefix: pipe[0], tag: pipe.slice(1).join(' | ') }
  return { tag: trimmed, prefix: '' }
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

async function importChallongeServer(
  url: string,
  apiKey: string,
): Promise<TournamentImport> {
  if (!apiKey) {
    throw new Error(
      'Challonge 需要 API Key：在请求体传 challongeApiKey，或设置环境变量 CHALLONGE_API_KEY',
    )
  }
  const slug = parseChallongeSlug(url)
  const qs = new URLSearchParams({
    include_participants: '1',
    api_key: apiKey,
  })
  const res = await fetch(
    `https://api.challonge.com/v1/tournaments/${encodeURIComponent(slug)}.json?${qs}`,
    { signal: AbortSignal.timeout(45000) },
  )
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Challonge API Key 无效或无权限访问该赛事')
    }
    if (res.status === 404) throw new Error('找不到该 Challonge 赛事，请检查链接')
    throw new Error(`Challonge 请求失败（${res.status}）`)
  }
  const body = (await res.json()) as { tournament: ChallongeTournament }
  const tournament = body.tournament
  if (!tournament) throw new Error('找不到该 Challonge 赛事')

  const ranked = (tournament.participants ?? [])
    .map((row) => row.participant)
    .filter((p) => p && typeof p.final_rank === 'number' && p.final_rank >= 1)
  if (ranked.length === 0) {
    throw new Error('该赛事尚未产生最终名次，请完赛后再生成')
  }

  const players = assignTop8Slots(
    ranked.map((p) => {
      const { tag, prefix } = parseTagName(p.name)
      return { placement: p.final_rank!, tag, prefix }
    }),
  )

  return {
    source: 'challonge',
    tournamentName: tournament.name,
    eventName: tournament.name,
    date: formatDate(tournament.completed_at ?? tournament.started_at),
    videogameName: tournament.game_name ?? '',
    numEntrants: tournament.participants_count ?? ranked.length,
    players,
  }
}

type ParryUser = {
  gamerTag?: string
  firstName?: string
  lastName?: string
  sponsorName?: string
}

type ParryResult = {
  placement?: {
    placement?: number
    eventEntrant?: {
      name?: string
      entrant?: { usersList?: ParryUser[] }
    }
  }
}

function parryDisplayName(result: ParryResult): { tag: string; prefix: string } {
  const users = result.placement?.eventEntrant?.entrant?.usersList ?? []
  const teamName = result.placement?.eventEntrant?.name?.trim()
  if (teamName) return { tag: teamName, prefix: '' }
  if (users.length === 0) return { tag: '', prefix: '' }
  if (users.length === 1) {
    const u = users[0]
    const tag =
      u.gamerTag?.trim() ||
      [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
      ''
    return { tag, prefix: u.sponsorName?.trim() ?? '' }
  }
  return {
    tag: users.map((u) => u.gamerTag?.trim()).filter(Boolean).join(' / '),
    prefix: users.find((u) => u.sponsorName?.trim())?.sponsorName?.trim() ?? '',
  }
}

async function importParryServer(urlOrSlug: string): Promise<TournamentImport> {
  const { tournamentSlug, eventSlug } = parseParrySlugPath(urlOrSlug)
  const url = `https://parry.gg/${tournamentSlug}/${eventSlug}/_standings`
  const upstream = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'EbifightClub-TOP8-Generator/1.0',
    },
    signal: AbortSignal.timeout(30000),
    redirect: 'follow',
  })
  if (!upstream.ok) throw new Error(`无法打开 parry.gg 页面（${upstream.status}）`)
  const html = await upstream.text()
  const payload = parseParryStandingsHtml(html) as {
    tournamentName: string
    eventName: string
    date: string
    videogameName: string
    numEntrants: number
    results: ParryResult[]
  }

  const players = assignTop8Slots(
    payload.results
      .map((result) => {
        const placement = result.placement?.placement
        const { tag, prefix } = parryDisplayName(result)
        if (!placement || !tag) return null
        return { placement, tag, prefix }
      })
      .filter((e): e is { placement: number; tag: string; prefix: string } => Boolean(e)),
  )

  if (players.filter((p) => p.tag).length === 0) {
    throw new Error('未从 parry.gg 解析到有效名次，请确认赛事已完赛')
  }

  return {
    source: 'parrygg',
    tournamentName: payload.tournamentName,
    eventName: payload.eventName,
    date: payload.date,
    videogameName: payload.videogameName,
    numEntrants: payload.numEntrants,
    players,
  }
}

/** Node 侧按赛事链接导入 TOP8（不依赖浏览器 / Vite 代理）。 */
export async function importTournamentServer(
  url: string,
  options: ServerImportOptions = {},
): Promise<TournamentImport> {
  const source = detectImportSource(url)
  const startggToken =
    options.startggToken?.trim() || process.env.STARTGG_TOKEN?.trim() || ''
  const challongeApiKey =
    options.challongeApiKey?.trim() || process.env.CHALLONGE_API_KEY?.trim() || ''

  switch (source) {
    case 'startgg':
      return importStartggServer(url, startggToken)
    case 'challonge':
      return importChallongeServer(url, challongeApiKey)
    case 'parrygg':
      return importParryServer(url)
    default:
      throw new Error(
        '无法识别链接来源，请提供 start.gg、Challonge 或 parry.gg 的赛事链接',
      )
  }
}
