import { assignTop8Slots, type TournamentImport } from './importTypes'

export type ParrySlugPath = {
  tournamentSlug: string
  eventSlug: string
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
      entrant?: {
        usersList?: ParryUser[]
      }
    }
  }
}

type ParryImportPayload = {
  tournamentName: string
  eventName: string
  date: string
  videogameName: string
  numEntrants: number
  results: ParryResult[]
}

export function parseParrySlugPath(input: string): ParrySlugPath {
  const raw = input.trim()
  const match = raw.match(/parry\.gg\/([^/?#]+)\/([^/?#]+)/i)
  if (match) {
    return {
      tournamentSlug: match[1].replace(/\/+$/, ''),
      eventSlug: match[2].replace(/\/+$/, '').replace(/^_standings$/i, ''),
    }
  }
  throw new Error(
    '请粘贴 parry.gg 赛事链接，例如 https://parry.gg/your-tournament/event-slug 或 .../_standings',
  )
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
    tag: users
      .map((u) => u.gamerTag?.trim())
      .filter(Boolean)
      .join(' / '),
    prefix: users.find((u) => u.sponsorName?.trim())?.sponsorName?.trim() ?? '',
  }
}

function normalizeParryUrl(input: string): string {
  const { tournamentSlug, eventSlug } = parseParrySlugPath(input)
  return `https://parry.gg/${tournamentSlug}/${eventSlug}/_standings`
}

export async function importParryggTop8(urlOrSlug: string): Promise<TournamentImport> {
  const url = normalizeParryUrl(urlOrSlug)
  const res = await fetch('/api/parrygg/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `parry.gg 请求失败（${res.status}）`)
  }

  const payload = (await res.json()) as ParryImportPayload
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

  const filled = players.filter((p) => p.tag).length
  if (filled === 0) {
    throw new Error('未从 parry.gg 页面解析到有效名次，请确认链接指向已完赛的 standings 页面')
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
