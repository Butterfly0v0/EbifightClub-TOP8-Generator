import { parseParryStandingsHtml } from '../src/lib/parryParse.ts'
import { assignTop8Slots, importIsTeam, type TournamentImport } from '../src/lib/importTypes.ts'
import { detectImportSource } from '../src/lib/tournamentImport.ts'
import { parseEventSlug } from '../src/lib/startgg.ts'
import { parseChallongeSlug } from '../src/lib/challonge.ts'
import { parryEntrantFields, parseParrySlugPath } from '../src/lib/parrygg.ts'
import {
  applyStartggCharacters,
  assignStartggStandings,
  STARTGG_SETS_FALLBACK_QUERY,
  STARTGG_SETS_QUERY,
  STARTGG_STANDINGS_FALLBACK_QUERY,
  STARTGG_STANDINGS_QUERY,
  startggEventIsTeam,
  type StartggSetsEvent,
  type StartggStandingsEvent,
} from '../src/lib/startggStandings.ts'

export type ServerImportOptions = {
  startggToken?: string
  challongeApiKey?: string
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

async function importStartggServer(
  url: string,
  token: string,
): Promise<TournamentImport> {
  const slug = parseEventSlug(url)
  let event: StartggStandingsEvent
  try {
    event = await startggGql<StartggStandingsEvent>(STARTGG_STANDINGS_QUERY, { slug }, token)
  } catch {
    event = await startggGql<StartggStandingsEvent>(STARTGG_STANDINGS_FALLBACK_QUERY, { slug }, token)
  }

  const rawNodes = event.standings?.nodes ?? []
  const isTeam = startggEventIsTeam(event, rawNodes)
  const { players, idBySlot, memberParticipantIds } = assignStartggStandings(rawNodes, isTeam)
  const ids = [...new Set(idBySlot.values())]
  if (ids.length) {
    try {
      let setEvent: StartggSetsEvent
      try {
        setEvent = await startggGql<StartggSetsEvent>(STARTGG_SETS_QUERY, { slug, ids }, token)
      } catch {
        setEvent = await startggGql<StartggSetsEvent>(STARTGG_SETS_FALLBACK_QUERY, { slug }, token)
      }
      applyStartggCharacters(players, idBySlot, memberParticipantIds, setEvent.sets)
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
    isTeam,
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
    isTeam: false,
    players,
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
  const payload = parseParryStandingsHtml(html)

  const players = assignTop8Slots(
    payload.results
      .map((result) => {
        const placement = result.placement?.placement
        const fields = parryEntrantFields(result)
        if (!placement || !fields.tag) return null
        return { placement, ...fields }
      })
      .filter((e): e is NonNullable<typeof e> => Boolean(e)),
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
    isTeam: importIsTeam(players),
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
