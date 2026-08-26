export type ImportedPlayer = {
  placement: number
  tag: string
  prefix: string
  characterNames: string[]
}

export type ImportSource = 'startgg' | 'challonge' | 'parrygg'

export type TournamentImport = {
  source: ImportSource
  tournamentName: string
  eventName: string
  date: string
  videogameName: string
  numEntrants: number | null
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

/** 保留原始名次（含并列），取前 8 条有效名次记录。 */
export function assignTop8Slots(
  entries: Array<{
    placement: number
    tag: string
    prefix?: string
    characterNames?: string[]
  }>,
): ImportedPlayer[] {
  const players = emptyImportedPlayers()
  const ranked = entries
    .filter((e) => e.placement >= 1 && e.placement <= 8 && e.tag.trim())
    .sort((a, b) => a.placement - b.placement || a.tag.localeCompare(b.tag))
    .slice(0, 8)

  ranked.forEach((entry, index) => {
    players[index] = {
      placement: entry.placement,
      tag: entry.tag,
      prefix: entry.prefix ?? '',
      characterNames: entry.characterNames ?? [],
    }
  })
  return players
}
