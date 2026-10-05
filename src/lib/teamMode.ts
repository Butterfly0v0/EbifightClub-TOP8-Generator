import type { CharacterPick, PlayerSlot, TeamMember, Top8Doc } from '../types'

/** 名次框里并排的队员上限（双打 2、三对三 3、五对五 5） */
export const MAX_TEAM_MEMBERS = 5

export function teamArtKey(playerIndex: number, memberIndex: number): string {
  return `${playerIndex}:t${memberIndex}`
}

export function emptyTeamMember(): TeamMember {
  return { tag: '', prefix: '', twitter: '', characters: [] }
}

/** 手动打开组队赛时，给还没有队员的名次铺一排空位，并把当前主选角色放在第一位。 */
export function seedTeamMembers(player: PlayerSlot, count = 3): TeamMember[] {
  const n = Math.min(MAX_TEAM_MEMBERS, Math.max(2, count))
  const main = player.characters.find((c) => c.codename || c.customImageDataUrl)
  return Array.from({ length: n }, (_, i) =>
    i === 0
      ? {
          tag: '',
          prefix: '',
          twitter: '',
          characters: main ? [{ ...main }] : [],
        }
      : emptyTeamMember(),
  )
}

export function teamMembersForRender(
  doc: Pick<Top8Doc, 'teamMode'>,
  player: PlayerSlot,
): TeamMember[] | null {
  if (!doc.teamMode) return null
  const members = (player.members ?? []).slice(0, MAX_TEAM_MEMBERS)
  if (members.length === 0) return null
  return members
}

export function memberMainPick(member: TeamMember): CharacterPick | undefined {
  return member.characters.find((c) => c.codename || c.customImageDataUrl)
}
