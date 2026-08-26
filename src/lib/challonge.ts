import { assignTop8Slots, type TournamentImport } from './importTypes'
import { getChallongeApiKey } from './importTokens'

type ChallongeParticipant = {
  id: number
  name: string
  final_rank: number | null
  seed?: number | null
}

type ChallongeTournament = {
  id: number
  name: string
  url: string
  participants_count: number
  started_at: string | null
  completed_at: string | null
  state: string
  game_name?: string | null
  participants?: Array<{ participant: ChallongeParticipant }>
}

/** 解析 Challonge 链接为 API 用的 tournament 标识（含社区子域） */
export function parseChallongeSlug(input: string): string {
  const raw = input.trim()
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw)
      const host = u.hostname.toLowerCase()
      const parts = u.pathname.split('/').filter(Boolean)
      const pathSlug = parts[0]
      if (!pathSlug) throw new Error('empty')

      // community.challonge.com/tourney -> community-tourney
      const sub = host.match(/^([a-z0-9-]+)\.challonge\.com$/i)
      if (sub && sub[1] !== 'www') {
        return `${sub[1]}-${pathSlug}`
      }
      if (host === 'challonge.com' || host === 'www.challonge.com') {
        return pathSlug
      }
    }
  } catch {
    // fall through
  }

  const match = raw.match(/challonge\.com\/([^/?#]+)/i)
  if (match) return match[1].replace(/\/+$/, '')
  if (/^[a-z0-9_-]+$/i.test(raw)) return raw
  throw new Error(
    '请粘贴 Challonge 赛事链接，例如 https://challonge.com/your_tournament 或 https://community.challonge.com/your_tournament',
  )
}

function parseTagName(name: string): { tag: string; prefix: string } {
  const trimmed = name.trim()
  if (!trimmed) return { tag: '', prefix: '' }
  const pipe = trimmed.split('|').map((s) => s.trim()).filter(Boolean)
  if (pipe.length >= 2) {
    return { prefix: pipe[0], tag: pipe.slice(1).join(' | ') }
  }
  return { tag: trimmed, prefix: '' }
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export async function importChallongeTop8(slugOrUrl: string): Promise<TournamentImport> {
  const slug = parseChallongeSlug(slugOrUrl)
  const apiKey = getChallongeApiKey()
  if (!apiKey) {
    throw new Error('请先填写 Challonge API Key（在 https://challonge.com/settings/developer 获取）')
  }

  const qs = new URLSearchParams({
    include_participants: '1',
    api_key: apiKey,
  })
  const res = await fetch(`/api/challonge/v1/tournaments/${encodeURIComponent(slug)}.json?${qs}`)
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Challonge API Key 无效或无权限访问该赛事')
    }
    if (res.status === 404) {
      throw new Error('找不到该 Challonge 赛事，请检查链接（社区赛事需用社区子域链接）')
    }
    throw new Error(`Challonge 请求失败（${res.status}）`)
  }

  const body = (await res.json()) as { tournament: ChallongeTournament }
  const tournament = body.tournament
  if (!tournament) throw new Error('找不到该 Challonge 赛事，请检查链接')

  const participants = (tournament.participants ?? [])
    .map((row) => row.participant)
    .filter(Boolean)

  const ranked = participants.filter(
    (p) => typeof p.final_rank === 'number' && p.final_rank >= 1,
  )
  if (ranked.length === 0) {
    throw new Error('该赛事尚未产生最终名次，请在 Challonge 完赛并确认后再导入')
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
