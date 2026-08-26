import {
  characterUrl,
  fetchCatalog,
  fetchGameCharacters,
  fetchPackConfig,
  gameLogoUrl,
  loadImage,
} from './assets'
import {
  resolveArtHeight,
} from './extraCharLayout'
import type { HeaderTextKey, SlotTextKey } from './layoutElements'
import { resolveHeaderTextContent, resolveTextBoxContent, resolveTextBoxPreview } from './layoutElements'
import type {
  TextBoxLayout,
  Top8Doc,
  CharacterDef,
  CharacterPick,
  ExtraCharLayoutConfig,
  ExtraCharStyleId,
  GameMeta,
  LayoutSlot,
  LayoutTheme,
  PackConfig,
  PlayerIdLayoutConfig,
  PlayerIdStyleId,
  PlayerSlot,
  Point,
} from '../types'

const PREVIEW_SAMPLE_KEY = 'layout-editor-preview-sample'
const PREVIEW_GAME_KEY = 'layout-editor-preview-game'
const PREVIEW_PACK_KEY = 'layout-editor-preview-pack'

export type SamplePreviewBundle = {
  headerDoc: Pick<
    Top8Doc,
    'tournamentName' | 'subtitle' | 'date' | 'numEntrants' | 'posterLocale'
  >
  players: PlayerSlot[]
  gameLogoUrl: string | null
}

const SAMPLE_TAGS: Array<{ prefix: string; tag: string; twitter: string }> = [
  { prefix: 'TEAM Alpha', tag: 'PlayerOne', twitter: '@playerone' },
  { prefix: 'FightClub', tag: 'SecondWind', twitter: '@2ndwind' },
  { prefix: '', tag: 'BronzeKing', twitter: '@bronze_k' },
  { prefix: 'Stream', tag: 'FourthPlace', twitter: '@fourth' },
  { prefix: 'Local', tag: 'FiveAlive', twitter: '@fivealive' },
  { prefix: 'EC', tag: 'SixthSense', twitter: '@sixth' },
  { prefix: 'West', tag: 'LuckySeven', twitter: '@lucky7' },
  { prefix: 'Guest', tag: 'EighthNote', twitter: '@e8th' },
]

export function readPreviewSampleEnabled(): boolean {
  try {
    return localStorage.getItem(PREVIEW_SAMPLE_KEY) === '1'
  } catch {
    return false
  }
}

export function writePreviewSampleEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREVIEW_SAMPLE_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function readPreviewGameCode(fallback: string): string {
  try {
    return localStorage.getItem(PREVIEW_GAME_KEY) || fallback
  } catch {
    return fallback
  }
}

export function writePreviewGameCode(gameCode: string): void {
  try {
    localStorage.setItem(PREVIEW_GAME_KEY, gameCode)
  } catch {
    /* ignore */
  }
}

export function readPreviewPackId(fallback = 'full'): string {
  try {
    return localStorage.getItem(PREVIEW_PACK_KEY) || fallback
  } catch {
    return fallback
  }
}

export function writePreviewPackId(packId: string): void {
  try {
    localStorage.setItem(PREVIEW_PACK_KEY, packId)
  } catch {
    /* ignore */
  }
}

export function buildSamplePlayers(characters: CharacterDef[]): PlayerSlot[] {
  return SAMPLE_TAGS.map((row, i) => {
    const placement = i + 1
    const picks: CharacterPick[] = []
    const main = characters[i % Math.max(1, characters.length)]
    if (main) picks.push({ codename: main.codename, skin: 0 })
    const alt = characters[(i + 1) % Math.max(1, characters.length)]
    if (alt && alt.codename !== main?.codename) {
      picks.push({ codename: alt.codename, skin: 0 })
    }
    const alt2 = characters[(i + 2) % Math.max(1, characters.length)]
    if (alt2 && !picks.some((p) => p.codename === alt2.codename)) {
      picks.push({ codename: alt2.codename, skin: 0 })
    }
    return {
      placement,
      prefix: row.prefix,
      tag: row.tag,
      twitter: row.twitter,
      characters: picks,
    }
  })
}

export function buildSamplePreviewBundle(characters: CharacterDef[]): SamplePreviewBundle {
  return {
    headerDoc: {
      tournamentName: 'EbifightClub #128',
      subtitle: 'Road to EVO',
      date: '2026-03-15',
      numEntrants: '256',
      posterLocale: 'zh',
    },
    players: buildSamplePlayers(characters),
    gameLogoUrl: null,
  }
}

export function resolveSampleHeaderText(key: HeaderTextKey, bundle: SamplePreviewBundle): string {
  return resolveHeaderTextContent(key, bundle.headerDoc as Top8Doc)
}

export function resolveSampleSlotPreviewText(
  key: SlotTextKey,
  place: number,
  bundle: SamplePreviewBundle,
  charNames: Map<string, string>,
): string {
  const player = bundle.players[place - 1]
  if (!player) return ''
  return resolveSlotTextContentFromKey(key, player, charNames)
}

function resolveSlotTextContentFromKey(
  key: SlotTextKey,
  player: PlayerSlot,
  charNames: Map<string, string>,
): string {
  switch (key) {
    case 'rank': {
      const p = player.placement
      return p === 1 ? '1ST' : p === 2 ? '2ND' : p === 3 ? '3RD' : `${p}TH`
    }
    case 'name':
      if (player.prefix && player.tag) return `${player.prefix} | ${player.tag}`
      return player.tag || 'TBD'
    case 'twitter': {
      const raw = player.twitter.trim()
      if (!raw) return ''
      return raw.startsWith('@') ? raw : `@${raw}`
    }
    case 'roster':
      return player.characters
        .filter((c) => c?.codename)
        .map((c) => charNames.get(c.codename) ?? c.codename)
        .join(' · ')
    default:
      return ''
  }
}

export function resolveEditorTextBoxPreview(
  box: TextBoxLayout,
  ctx: {
    scope: 'header' | 'slot'
    builtInKey?: HeaderTextKey | SlotTextKey
    place?: number
    bundle?: SamplePreviewBundle | null
    charNames?: Map<string, string>
  },
): string {
  if (ctx.bundle) {
    if (ctx.scope === 'header') {
      return resolveTextBoxContent(box, {
        scope: 'header',
        doc: ctx.bundle.headerDoc as Top8Doc,
        builtInKey: ctx.builtInKey as HeaderTextKey,
      })
    }
    const player = ctx.bundle.players[(ctx.place ?? 1) - 1]
    if (player) {
      return resolveTextBoxContent(box, {
        scope: 'slot',
        doc: ctx.bundle.headerDoc as Top8Doc,
        player,
        charNames: ctx.charNames,
        showRoster: true,
        builtInKey: ctx.builtInKey as SlotTextKey,
      })
    }
  }
  return resolveTextBoxPreview(box, {
    scope: ctx.scope,
    builtInKey: ctx.builtInKey,
    place: ctx.place,
  })
}

export { resolveArtScale } from './artScale'

export function resolveEyesight(
  pack: PackConfig,
  codename: string,
  skin: number,
): Point | undefined {
  const pt = pack.eyesights?.[codename]?.[String(skin)]
  return pt ? { x: pt.x, y: pt.y } : undefined
}

export type ArtRect = { x: number; y: number; w: number; h: number }

/** 与 render.ts 一致的立绘裁剪区域（画布坐标） */
export function computeSlotArtRect(
  slot: LayoutSlot,
  place: number,
  opts: {
    theme?: LayoutTheme
    extraCharStyleId: ExtraCharStyleId
    playerIdStyleId: PlayerIdStyleId
    extraCount: number
    hasRoster?: boolean
    extraCharLayout?: ExtraCharLayoutConfig
    playerIdLayout?: PlayerIdLayoutConfig
  },
): ArtRect {
  const paragon = opts.theme === 'paragon'
  const hasRoster = opts.hasRoster ?? false
  const paragonNamePlateH = paragon ? (place === 1 ? 52 : 40) : 0
  const paragonBottomH = paragon ? paragonNamePlateH : 0

  const artH = paragon
    ? slot.h - paragonBottomH
    : opts.theme === 'animefgc'
      ? slot.playerIndex === 0
        ? slot.h - 72
        : slot.h
      : opts.theme === 'ebifc'
        ? slot.h - (place === 1 ? 56 : 44)
        : resolveArtHeight(slot, place, opts.playerIdStyleId, hasRoster, opts.playerIdLayout)

  return {
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: artH,
  }
}

export function artRectRelativeToSlot(slot: LayoutSlot, art: ArtRect): ArtRect {
  return {
    x: art.x - slot.x,
    y: art.y - slot.y,
    w: art.w,
    h: art.h,
  }
}

export async function loadPreviewAssetContext(
  gameCode: string,
  packId?: string,
): Promise<{
  game: GameMeta
  packId: string
  pack: PackConfig
  characters: CharacterDef[]
} | null> {
  const catalog = await fetchCatalog()
  const game = catalog[gameCode]
  if (!game) return null
  const resolvedPackId =
    packId && game.packs.some((p) => p.id === packId)
      ? packId
      : game.packs.find((p) => p.id === 'full')?.id ?? game.packs[0]?.id
  if (!resolvedPackId) return null
  const [pack, characters] = await Promise.all([
    fetchPackConfig(game, resolvedPackId),
    fetchGameCharacters(gameCode),
  ])
  return { game, packId: resolvedPackId, pack, characters }
}

export async function loadSampleCharacterImages(
  game: GameMeta,
  packId: string,
  pack: PackConfig,
  characters: CharacterDef[],
  slotCount: number,
  extraCount: number,
): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>()
  if (characters.length === 0) return out

  const tasks: Array<Promise<void>> = []
  for (let i = 0; i < slotCount; i++) {
    const main = characters[i % characters.length]
    if (main?.codename) {
      tasks.push(
        loadImage(characterUrl(game, packId, pack, main.codename, 0))
          .then((img) => {
            out.set(`${i}:0`, img)
          })
          .catch(() => undefined),
      )
    }
    for (let e = 0; e < extraCount; e++) {
      const pick = characters[(i + e + 1) % characters.length]
      if (!pick?.codename) continue
      tasks.push(
        loadImage(characterUrl(game, packId, pack, pick.codename, 0))
          .then((img) => {
            out.set(`${i}:${e + 1}`, img)
          })
          .catch(() => undefined),
      )
    }
  }

  await Promise.all(tasks)
  return out
}

export async function loadPreviewLogos(
  gameCode: string,
  customLogoUrl: string,
): Promise<{ gameLogo: HTMLImageElement | null; customLogo: HTMLImageElement | null }> {
  let gameLogo: HTMLImageElement | null = null
  let customLogo: HTMLImageElement | null = null
  try {
    gameLogo = await loadImage(gameLogoUrl(gameCode))
  } catch {
    /* optional */
  }
  try {
    customLogo = await loadImage(customLogoUrl)
  } catch {
    /* optional */
  }
  return { gameLogo, customLogo }
}

export async function loadGameLogoImage(gameCode: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(gameLogoUrl(gameCode))
  } catch {
    return null
  }
}
