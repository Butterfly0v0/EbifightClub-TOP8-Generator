import { matchCharacter, matchGame } from './assets'
import { buildTop8DocFromApiRequest, type Top8ApiPlayer, type Top8ApiRequest } from './top8Api'
import type { TournamentImport } from './importTypes'
import type { Catalog, CharacterDef, Top8Doc } from '../types'

export type ImportDocOverrides = Omit<Top8ApiRequest, 'gameCode' | 'players' | 'doc'> & {
  /** 强制指定游戏码；不传则按赛事 videogameName 匹配素材目录 */
  gameCode?: string
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
    const players: Top8ApiPlayer[] = imported.players.map((p) => ({
      placement: p.placement,
      tag: p.tag,
      prefix: p.prefix,
      twitter: '',
      characters: p.characterNames
        .map((name) => matchCharacter(characters, name))
        .filter((c): c is CharacterDef => Boolean(c))
        .map((c) => ({ codename: c.codename, skin: 0 })),
    }))

    const req: Top8ApiRequest = {
      ...overrides,
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
