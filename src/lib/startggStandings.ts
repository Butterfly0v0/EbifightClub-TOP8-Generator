import {
  assignTop8Slots,
  type ImportedMember,
  type ImportedPlayer,
} from './importTypes'
import { MAX_TEAM_MEMBERS } from './teamMode'

export const STARTGG_STANDINGS_QUERY = `
query Top8Standings($slug: String!) {
  event(slug: $slug) {
    name
    numEntrants
    startAt
    teamRosterSize { maxPlayers }
    videogame { id name }
    tournament { name city }
    standings(query: { page: 1, perPage: 24, sortBy: "placement" }) {
      nodes {
        placement
        entrant {
          id
          name
          participants { id gamerTag prefix }
        }
      }
    }
  }
}
`

export const STARTGG_STANDINGS_FALLBACK_QUERY = `
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
          participants { id gamerTag prefix }
        }
      }
    }
  }
}
`

export const STARTGG_SETS_QUERY = `
query Top8Sets($slug: String!, $ids: [ID]!) {
  event(slug: $slug) {
    sets(page: 1, perPage: 50, sortType: RECENT, filters: { entrantIds: $ids }) {
      nodes {
        games {
          selections {
            character { name }
            entrant { id }
            participant { id }
          }
        }
      }
    }
  }
}
`

export const STARTGG_SETS_FALLBACK_QUERY = `
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

export type StartggParticipant = {
  id?: number | string
  gamerTag: string
  prefix: string | null
}

export type StartggStandingNode = {
  placement: number
  entrant: {
    id: number | string
    name: string
    participants: StartggParticipant[] | null
  } | null
}

export type StartggStandingsEvent = {
  name: string
  numEntrants: number | null
  startAt: number | null
  teamRosterSize?: { maxPlayers: number | null } | null
  videogame: { id: number; name: string } | null
  tournament: { name: string; city: string | null } | null
  standings: { nodes: StartggStandingNode[] } | null
}

export type StartggSetsEvent = {
  sets: {
    nodes: Array<{
      games: Array<{
        selections: Array<{
          character: { name: string } | null
          entrant: { id: number | string } | null
          participant?: { id: number | string } | null
        }> | null
      }> | null
    }> | null
  } | null
}

type MemberDraft = ImportedMember & { participantId: string }

export function startggEventIsTeam(
  event: Pick<StartggStandingsEvent, 'teamRosterSize'>,
  nodes: StartggStandingNode[],
): boolean {
  const max = event.teamRosterSize?.maxPlayers
  if (typeof max === 'number' && max > 1) return true
  return nodes.some((node) => {
    if (!node.entrant || node.placement < 1 || node.placement > 8) return false
    return (node.entrant.participants?.length ?? 0) > 1
  })
}

export function assignStartggStandings(
  nodes: StartggStandingNode[],
  isTeam: boolean,
): {
  players: ImportedPlayer[]
  idBySlot: Map<number, string>
  memberParticipantIds: Map<number, string[]>
} {
  const players = assignTop8Slots([])
  const idBySlot = new Map<number, string>()
  const memberParticipantIds = new Map<number, string[]>()
  const ranked = nodes
    .filter((n) => n.entrant && n.placement >= 1 && n.placement <= 8)
    .sort(
      (a, b) =>
        a.placement - b.placement ||
        String(a.entrant?.id ?? '').localeCompare(String(b.entrant?.id ?? '')),
    )

  ranked.slice(0, 8).forEach((node, index) => {
    if (!node.entrant) return
    const participants = node.entrant.participants ?? []
    const solo = participants[0]
    const drafts: MemberDraft[] = isTeam
      ? participants.slice(0, MAX_TEAM_MEMBERS).map((p) => ({
          tag: (p.gamerTag || '').trim(),
          prefix: (p.prefix ?? '').trim(),
          characterNames: [],
          participantId: p.id == null ? '' : String(p.id),
        }))
      : []
    const members = drafts.filter((m) => m.tag)
    players[index] = {
      placement: node.placement,
      tag: isTeam ? node.entrant.name || solo?.gamerTag || '' : solo?.gamerTag || node.entrant.name,
      prefix: isTeam ? '' : (solo?.prefix ?? ''),
      characterNames: [],
      members:
        members.length > 0
          ? members.map(({ tag, prefix, characterNames }) => ({ tag, prefix, characterNames }))
          : undefined,
    }
    idBySlot.set(index, String(node.entrant.id))
    if (members.length) {
      memberParticipantIds.set(
        index,
        members.map((m) => m.participantId),
      )
    }
  })

  return { players, idBySlot, memberParticipantIds }
}

function bump(bag: Map<string, number>, name: string) {
  bag.set(name, (bag.get(name) ?? 0) + 1)
}

function topNames(bag: Map<string, number> | undefined, limit: number): string[] {
  if (!bag) return []
  return [...bag.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
    .slice(0, limit)
}

/** 把近期对局里的角色填回名次。组队赛按 participant 归到对应队员，对不上时再按出场次数分给队员。 */
export function applyStartggCharacters(
  players: ImportedPlayer[],
  idBySlot: Map<number, string>,
  memberParticipantIds: Map<number, string[]>,
  sets: StartggSetsEvent['sets'],
): void {
  const byEntrant = new Map<string, Map<string, number>>()
  const byParticipant = new Map<string, Map<string, number>>()

  for (const set of sets?.nodes ?? []) {
    for (const game of set?.games ?? []) {
      for (const sel of game?.selections ?? []) {
        const eid = sel?.entrant?.id == null ? '' : String(sel.entrant.id)
        const cname = sel?.character?.name
        if (!eid || !cname) continue
        const entrantBag = byEntrant.get(eid) ?? new Map<string, number>()
        bump(entrantBag, cname)
        byEntrant.set(eid, entrantBag)
        const pid = sel.participant?.id == null ? '' : String(sel.participant.id)
        if (!pid) continue
        const key = `${eid}:${pid}`
        const partBag = byParticipant.get(key) ?? new Map<string, number>()
        bump(partBag, cname)
        byParticipant.set(key, partBag)
      }
    }
  }

  for (const [slot, eid] of idBySlot) {
    const player = players[slot]
    if (!player) continue
    const members = player.members
    if (!members?.length) {
      player.characterNames = topNames(byEntrant.get(eid), 3)
      continue
    }
    const ids = memberParticipantIds.get(slot) ?? []
    const next = members.map((member, i) => {
      const pid = ids[i] ?? ''
      const names = pid ? topNames(byParticipant.get(`${eid}:${pid}`), 1) : []
      return { ...member, characterNames: names }
    })
    const pool = topNames(byEntrant.get(eid), next.length)
    let cursor = 0
    const used = new Set(next.flatMap((m) => m.characterNames))
    for (const member of next) {
      if (member.characterNames.length > 0) continue
      while (cursor < pool.length && used.has(pool[cursor]!)) cursor += 1
      const name = pool[cursor]
      if (!name) break
      member.characterNames = [name]
      used.add(name)
      cursor += 1
    }
    player.members = next
    player.characterNames = next.flatMap((m) => m.characterNames)
  }
}
