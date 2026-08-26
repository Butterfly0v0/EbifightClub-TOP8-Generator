import { importChallongeTop8 } from './challonge'
import type { ImportSource, TournamentImport } from './importTypes'
import { importParryggTop8 } from './parrygg'
import { importStartggTop8 } from './startgg'

export type { ImportedPlayer, ImportSource, TournamentImport } from './importTypes'

export function detectImportSource(input: string): ImportSource | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  if (raw.includes('start.gg') || raw.startsWith('tournament/')) return 'startgg'
  if (raw.includes('parry.gg')) return 'parrygg'
  if (raw.includes('challonge.com')) return 'challonge'
  return null
}

export async function importTournament(url: string): Promise<TournamentImport> {
  const source = detectImportSource(url)
  switch (source) {
    case 'challonge':
      return importChallongeTop8(url)
    case 'parrygg':
      return importParryggTop8(url)
    case 'startgg':
      return importStartggTop8(url)
    default:
      throw new Error(
        '无法识别链接来源，请粘贴 start.gg、Challonge 或 parry.gg 的赛事链接',
      )
  }
}
