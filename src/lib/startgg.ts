import type { TournamentImport } from './importTypes'
import { getStartggToken } from './importTokens'
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
} from './startggStandings'

export { getStartggToken, setStartggToken } from './importTokens'
export type { ImportedPlayer } from './importTypes'

export function parseEventSlug(input: string): string {
  const raw = input.trim()
  const match = raw.match(/tournament\/[^/?#]+\/event\/[^/?#]+/i)
  if (match) return match[0].replace(/\/+$/, '')
  if (raw.startsWith('tournament/')) return raw.replace(/\/+$/, '')
  throw new Error('请粘贴 start.gg 赛事链接，例如 https://www.start.gg/tournament/.../event/...')
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

export async function importStartggTop8(slugOrUrl: string): Promise<TournamentImport> {
  const slug = parseEventSlug(slugOrUrl)
  let event: StartggStandingsEvent
  try {
    event = await gql<StartggStandingsEvent>(STARTGG_STANDINGS_QUERY, { slug })
  } catch {
    event = await gql<StartggStandingsEvent>(STARTGG_STANDINGS_FALLBACK_QUERY, { slug })
  }

  const rawNodes = event.standings?.nodes ?? []
  const isTeam = startggEventIsTeam(event, rawNodes)
  const { players, idBySlot, memberParticipantIds } = assignStartggStandings(rawNodes, isTeam)

  const ids = [...new Set(idBySlot.values())]
  if (ids.length) {
    try {
      let setEvent: StartggSetsEvent
      try {
        setEvent = await gql<StartggSetsEvent>(STARTGG_SETS_QUERY, { slug, ids })
      } catch {
        setEvent = await gql<StartggSetsEvent>(STARTGG_SETS_FALLBACK_QUERY, { slug })
      }
      applyStartggCharacters(players, idBySlot, memberParticipantIds, setEvent.sets)
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
    isTeam,
    players,
  }
}

/** @deprecated 使用 importStartggTop8 */
export const importTop8 = importStartggTop8
