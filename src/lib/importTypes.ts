/** 导入阶段的队员（角色名尚未匹配到素材包） */
export type ImportedMember = {
  tag: string
  prefix: string
  characterNames: string[]
}

export type ImportedPlayer = {
  placement: number
  /** 单人赛为选手名；组队赛为队名 */
  tag: string
  prefix: string
  characterNames: string[]
  members?: ImportedMember[]
}

export type ImportSource = 'startgg' | 'challonge' | 'parrygg'

export type TournamentImport = {
  source: ImportSource
  tournamentName: string
  eventName: string
  date: string
  videogameName: string
  numEntrants: number | null
  /** 组队赛（多名队员组成一个名次） */
  isTeam: boolean
  players: ImportedPlayer[]
}

export function emptyImportedPlayers(): ImportedPlayer[] {
  return Array.from({ length: 8 }, (_, i) => ({
    placement: i + 1,
    tag: '',
    prefix: '',
    characterNames: [],
  }))
}

const MAX_IMPORTED_MEMBERS = 5

/** 保留原始名次（含并列），取前 8 条有效名次记录。 */
export function assignTop8Slots(
  entries: Array<{
    placement: number
    tag: string
    prefix?: string
    characterNames?: string[]
    members?: ImportedMember[]
  }>,
): ImportedPlayer[] {
  const players = emptyImportedPlayers()
  const ranked = entries
    .filter((e) => e.placement >= 1 && e.placement <= 8 && e.tag.trim())
    .sort((a, b) => a.placement - b.placement || a.tag.localeCompare(b.tag))
    .slice(0, 8)

  ranked.forEach((entry, index) => {
    const members = (entry.members ?? [])
      .map((m) => ({
        tag: m.tag.trim(),
        prefix: (m.prefix ?? '').trim(),
        characterNames: m.characterNames ?? [],
      }))
      .filter((m) => m.tag)
      .slice(0, MAX_IMPORTED_MEMBERS)
    players[index] = {
      placement: entry.placement,
      tag: entry.tag,
      prefix: entry.prefix ?? '',
      characterNames: entry.characterNames ?? [],
      members: members.length > 0 ? members : undefined,
    }
  })
  return players
}

export function importIsTeam(players: ImportedPlayer[]): boolean {
  return players.some((p) => (p.members?.length ?? 0) > 1)
}
