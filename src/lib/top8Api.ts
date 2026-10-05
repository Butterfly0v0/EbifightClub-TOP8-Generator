import { builtInLayoutDocDefaults } from './layouts'
import { defaultDoc, emptyPlayers, normalizeLoadedDoc } from './storage'
import { MAX_TEAM_MEMBERS } from './teamMode'
import type {
  BuiltInLayoutId,
  CharacterPick,
  CustomLayoutDef,
  PlayerSlot,
  PosterLocale,
  TeamMember,
  Top8Doc,
} from '../types'

export type Top8ApiCharacter = {
  codename?: string
  skin?: number
  /** 自定义立绘：data URL 或 /user-assets/... 路径 */
  customImageUrl?: string
  artScale?: number
  imageFocusX?: number
  imageFocusY?: number
}

/** 组队赛队员 */
export type Top8ApiMember = {
  tag?: string
  prefix?: string
  twitter?: string
  characters?: Top8ApiCharacter[]
}

/** 外部 API 精简选手结构 */
export type Top8ApiPlayer = {
  tag?: string
  prefix?: string
  twitter?: string
  placement?: number
  characters?: Top8ApiCharacter[]
  /** 组队赛队员；与 teamMode 一起使用 */
  members?: Top8ApiMember[]
}

/** 外部程序调用 POST /api/v1/top8/render 的请求体 */
export type Top8ApiRequest = {
  /** 游戏码，如 sf6 / gbvsr */
  gameCode: string
  /** 素材包，默认 full */
  packId?: string
  /** 内置布局 id；也可传 custom 并附 customLayout */
  layoutId?: BuiltInLayoutId | 'custom'
  customLayout?: CustomLayoutDef
  tournamentName?: string
  subtitle?: string
  date?: string
  numEntrants?: string | number
  posterLocale?: PosterLocale
  accent?: string
  background?: string
  /** 背景图：data URL 或 /user-assets/... */
  backgroundImageUrl?: string
  backgroundDim?: number
  logoUrl?: string
  showCredits?: boolean
  showExtraCharNames?: boolean
  titleFontId?: string
  playerFontId?: string
  rankFontId?: string
  /** 组队赛：每个名次并排画队员立绘 */
  teamMode?: boolean
  /** 选手列表（1–8 名；不足补空） */
  players?: Top8ApiPlayer[]
  /** 直接传入完整/部分 Top8Doc（优先级高于上面字段，会与默认合并） */
  doc?: Partial<Top8Doc>
  options?: {
    format?: 'png'
    locale?: PosterLocale
  }
}

export type Top8ApiJobStatus = 'queued' | 'rendering' | 'done' | 'error'

export type Top8ApiJobMeta = {
  id: string
  status: Top8ApiJobStatus
  createdAt: string
  error?: string
  doc: Top8Doc
}

function toCharacterPick(c: Top8ApiCharacter): CharacterPick {
  return {
    codename: c.codename ?? '',
    skin: typeof c.skin === 'number' ? c.skin : 0,
    customImageDataUrl: c.customImageUrl ?? '',
    artScale:
      typeof c.artScale === 'number' && Number.isFinite(c.artScale)
        ? Math.min(2.5, Math.max(0.5, c.artScale))
        : 1,
    imageFocusX:
      typeof c.imageFocusX === 'number' && Number.isFinite(c.imageFocusX)
        ? Math.min(1, Math.max(0, c.imageFocusX))
        : undefined,
    imageFocusY:
      typeof c.imageFocusY === 'number' && Number.isFinite(c.imageFocusY)
        ? Math.min(1, Math.max(0, c.imageFocusY))
        : undefined,
  }
}

function toTeamMember(raw: Top8ApiMember): TeamMember {
  return {
    tag: raw.tag ?? '',
    prefix: raw.prefix ?? '',
    twitter: raw.twitter ?? '',
    characters: (raw.characters ?? []).slice(0, 1).map(toCharacterPick),
  }
}

function toApiPlayers(list: Top8ApiPlayer[] | undefined): PlayerSlot[] {
  const base = emptyPlayers()
  if (!list?.length) return base
  return base.map((slot, i) => {
    const raw = list[i]
    if (!raw) return slot
    const characters: CharacterPick[] = (raw.characters ?? []).slice(0, 3).map(toCharacterPick)
    const members = (raw.members ?? [])
      .slice(0, MAX_TEAM_MEMBERS)
      .map(toTeamMember)
      .filter((member) => member.tag.trim() || member.characters.some((c) => c.codename || c.customImageDataUrl))
    return {
      placement: raw.placement ?? i + 1,
      tag: raw.tag ?? '',
      prefix: raw.prefix ?? '',
      twitter: raw.twitter ?? '',
      characters,
      members: members.length > 0 ? members : undefined,
    }
  })
}

/**
 * 将精简 API 请求合并为可渲染的 Top8Doc。
 * 布局默认参数来自内置模板；再叠加请求字段与可选 doc 片段。
 */
export function buildTop8DocFromApiRequest(req: Top8ApiRequest): Top8Doc {
  const gameCode = String(req.gameCode || 'sf6').trim() || 'sf6'
  const layoutIdRaw = req.layoutId ?? req.doc?.layoutId ?? 'classic'
  const layoutDefaults =
    layoutIdRaw !== 'custom' && typeof layoutIdRaw === 'string'
      ? builtInLayoutDocDefaults(layoutIdRaw as BuiltInLayoutId)
      : {}

  const base = defaultDoc(gameCode)
  const merged: Top8Doc = {
    ...base,
    ...layoutDefaults,
    gameCode,
    packId: req.packId ?? req.doc?.packId ?? layoutDefaults.packId ?? base.packId,
    layoutId: (layoutIdRaw as Top8Doc['layoutId']) ?? 'classic',
    customLayout: req.customLayout ?? req.doc?.customLayout ?? null,
    tournamentName: req.tournamentName ?? req.doc?.tournamentName ?? base.tournamentName,
    subtitle: req.subtitle ?? req.doc?.subtitle ?? base.subtitle,
    date: req.date ?? req.doc?.date ?? base.date,
    numEntrants:
      req.numEntrants != null
        ? String(req.numEntrants)
        : (req.doc?.numEntrants ?? base.numEntrants),
    posterLocale:
      req.options?.locale ?? req.posterLocale ?? req.doc?.posterLocale ?? base.posterLocale,
    accent: req.accent ?? req.doc?.accent ?? layoutDefaults.accent ?? base.accent,
    background: req.background ?? req.doc?.background ?? layoutDefaults.background ?? base.background,
    backgroundImageDataUrl:
      req.backgroundImageUrl ??
      req.doc?.backgroundImageDataUrl ??
      layoutDefaults.backgroundImageDataUrl ??
      '',
    backgroundDim:
      req.backgroundDim ??
      req.doc?.backgroundDim ??
      layoutDefaults.backgroundDim ??
      base.backgroundDim,
    logoDataUrl: req.logoUrl ?? req.doc?.logoDataUrl ?? '',
    showCredits: req.showCredits ?? req.doc?.showCredits ?? base.showCredits,
    showExtraCharNames: req.showExtraCharNames ?? req.doc?.showExtraCharNames ?? base.showExtraCharNames,
    titleFontId: req.titleFontId ?? req.doc?.titleFontId ?? layoutDefaults.titleFontId ?? base.titleFontId,
    playerFontId: req.playerFontId ?? req.doc?.playerFontId ?? layoutDefaults.playerFontId ?? base.playerFontId,
    rankFontId: req.rankFontId ?? req.doc?.rankFontId ?? layoutDefaults.rankFontId ?? base.rankFontId,
    teamMode: req.teamMode === true || req.doc?.teamMode === true,
    players: req.players ? toApiPlayers(req.players) : (req.doc?.players ?? base.players),
    ...(req.doc
      ? {
          headerStyleId: req.doc.headerStyleId ?? layoutDefaults.headerStyleId ?? base.headerStyleId,
          extraCharStyleId: req.doc.extraCharStyleId ?? layoutDefaults.extraCharStyleId ?? base.extraCharStyleId,
          playerIdStyleId: req.doc.playerIdStyleId ?? layoutDefaults.playerIdStyleId ?? base.playerIdStyleId,
          defaultBoxStyle: req.doc.defaultBoxStyle ?? layoutDefaults.defaultBoxStyle ?? base.defaultBoxStyle,
          playerBoxOpacity: req.doc.playerBoxOpacity ?? layoutDefaults.playerBoxOpacity ?? base.playerBoxOpacity,
          globalArtScale: req.doc.globalArtScale ?? layoutDefaults.globalArtScale ?? base.globalArtScale,
          extraCharLayout: req.doc.extraCharLayout ?? layoutDefaults.extraCharLayout,
          playerIdLayout: req.doc.playerIdLayout ?? layoutDefaults.playerIdLayout,
          layoutOverrides: req.doc.layoutOverrides,
        }
      : {}),
  }

  return normalizeLoadedDoc(merged, gameCode)
}

export function validateTop8ApiRequest(body: unknown): { ok: true; req: Top8ApiRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: '请求体必须是 JSON 对象' }
  const req = body as Top8ApiRequest
  if (!req.gameCode && !req.doc?.gameCode) {
    return { ok: false, error: '缺少 gameCode' }
  }
  if (req.players && !Array.isArray(req.players)) {
    return { ok: false, error: 'players 必须是数组' }
  }
  if (req.players && req.players.length > 8) {
    return { ok: false, error: 'players 最多 8 名' }
  }
  return { ok: true, req }
}
