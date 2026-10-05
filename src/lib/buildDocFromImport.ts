import { matchCharacter, matchGame } from './assets'
import { buildTop8DocFromApiRequest, type Top8ApiPlayer, type Top8ApiRequest } from './top8Api'
import type { ImportedPlayer, TournamentImport } from './importTypes'
import { MAX_TEAM_MEMBERS } from './teamMode'
import type { Catalog, CharacterDef, CharacterPick, PlayerSlot, Top8Doc } from '../types'

export type ImportDocOverrides = Omit<Top8ApiRequest, 'gameCode' | 'players' | 'doc'> & {
  /** 强制指定游戏码；不传则按赛事 videogameName 匹配素材目录 */
  gameCode?: string
}

function picksForNames(characters: CharacterDef[], names: string[]): CharacterPick[] {
  return names
    .map((name) => matchCharacter(characters, name))
    .filter((c): c is CharacterDef => Boolean(c))
    .map((c) => ({ codename: c.codename, skin: 0 }))
}

/** 把导入名次（含组队赛队员）匹配成海报选手槽。 */
export function playerSlotsFromImport(
  imported: ImportedPlayer[],
  characters: CharacterDef[],
): PlayerSlot[] {
  return imported.map((player) => {
    const members = player.members?.slice(0, MAX_TEAM_MEMBERS).map((member) => ({
      tag: member.tag,
      prefix: member.prefix,
      twitter: '',
      characters: picksForNames(characters, member.characterNames).slice(0, 1),
    }))
    const memberArts = members?.flatMap((member) => member.characters) ?? []
    return {
      placement: player.placement,
      tag: player.tag,
      prefix: player.prefix,
      twitter: '',
      characters: memberArts.length > 0 ? memberArts : picksForNames(characters, player.characterNames),
      members: members && members.length > 0 ? members : undefined,
    }
  })
}

/**
 * 将赛事导入结果 + 素材目录合成为可渲染的 Top8Doc。
 * 角色名按 smashgg_name / 显示名 / codename 匹配。
 */
export function buildTop8DocFromImport(
  imported: TournamentImport,
  catalog: Catalog,
  charactersByGame: (gameCode: string) => CharacterDef[] | Promise<CharacterDef[]>,
  overrides: ImportDocOverrides = {},
): Promise<{ doc: Top8Doc; gameCode: string; matchedGameName: string }> {
  return (async () => {
    const matched = imported.videogameName
      ? matchGame(catalog, imported.videogameName)
      : undefined
    const gameCode =
      (overrides.gameCode?.trim() || matched?.code || 'sf6').trim() || 'sf6'
    const game = catalog[gameCode]
    if (!game) {
      throw new Error(
        `未知游戏码「${gameCode}」${imported.videogameName ? `（赛事游戏：${imported.videogameName}）` : ''}。请传入正确的 gameCode。`,
      )
    }

    const characters = await charactersByGame(gameCode)
    const slots = playerSlotsFromImport(imported.players, characters)
    const players: Top8ApiPlayer[] = slots.map((slot) => ({
      placement: slot.placement,
      tag: slot.tag,
      prefix: slot.prefix,
      twitter: slot.twitter,
      characters: slot.characters.map((c) => ({ codename: c.codename, skin: c.skin })),
      members: slot.members?.map((member) => ({
        tag: member.tag,
        prefix: member.prefix,
        twitter: member.twitter,
        characters: member.characters.map((c) => ({
          codename: c.codename,
          skin: c.skin,
        })),
      })),
    }))

    const req: Top8ApiRequest = {
      ...overrides,
      teamMode: imported.isTeam,
      gameCode,
      packId: overrides.packId ?? 'full',
      tournamentName: overrides.tournamentName ?? imported.tournamentName,
      subtitle: overrides.subtitle ?? imported.eventName,
      date: overrides.date ?? imported.date,
      numEntrants:
        overrides.numEntrants ??
        (imported.numEntrants != null && imported.numEntrants > 0
          ? imported.numEntrants
          : undefined),
      players,
    }

    return {
      doc: buildTop8DocFromApiRequest(req),
      gameCode,
      matchedGameName: game.name,
    }
  })()
}
