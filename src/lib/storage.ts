import type { PlayerSlot, Top8Doc, CustomLayoutDef } from '../types'
import { DEFAULT_BOX_STYLE, normalizeBoxStyle } from './boxThemes'
import { normalizeThemeConfig } from './themeConfig'
import { DEFAULT_PLAYER_FONT, DEFAULT_RANK_FONT, DEFAULT_TITLE_FONT, isValidFontId } from './fonts'
import { type LayoutFieldOverrides } from './layoutDefaults'
import { saveApiUrl } from './projectPaths'

const LEGACY_DOC_KEY = 'ebi-top8-doc'
const DOCS_LS_PREFIX = 'ebi-top8-doc:'

function docsLocalKey(gameCode: string): string {
  return `${DOCS_LS_PREFIX}${gameCode}`
}

export function emptyPlayers(): PlayerSlot[] {
  return Array.from({ length: 8 }, (_, i) => ({
    placement: i + 1,
    tag: '',
    prefix: '',
    twitter: '',
    characters: [],
  }))
}

export function defaultDoc(gameCode = 'sf6'): Top8Doc {
  return {
    tournamentName: 'EbifightClub',
    subtitle: 'Weekly TOP 8',
    date: new Date().toISOString().slice(0, 10),
    numEntrants: '',
    posterLocale: 'zh',
    headerStyleId: 'compact',
    extraCharStyleId: 'bottomRow',
    playerIdStyleId: 'overlay',
    titleFontId: DEFAULT_TITLE_FONT,
    playerFontId: DEFAULT_PLAYER_FONT,
    rankFontId: DEFAULT_RANK_FONT,
    defaultBoxStyle: { ...DEFAULT_BOX_STYLE },
    gameCode,
    packId: 'full',
    layoutId: 'classic',
    customLayout: null,
    accent: '#ff4d2e',
    background: '#0b0c11',
    backgroundImageDataUrl: '',
    backgroundDim: 0.45,
    playerBoxOpacity: 1,
    showCredits: true,
    showExtraCharNames: true,
    globalArtScale: 1,
    logoDataUrl: '',
    players: emptyPlayers(),
  }
}

function normalizePlayers(players: Top8Doc['players'] | undefined): Top8Doc['players'] {
  if (!players || players.length !== 8) return emptyPlayers()
  return players.map((p, i) => ({
    placement: p.placement ?? i + 1,
    tag: p.tag ?? '',
    prefix: p.prefix ?? '',
    twitter: p.twitter ?? '',
    characters: (p.characters ?? []).map((c) => ({
      codename: c.codename ?? '',
      skin: c.skin ?? 0,
      customImageDataUrl: c.customImageDataUrl ?? '',
      artScale:
        typeof c.artScale === 'number' && Number.isFinite(c.artScale)
          ? Math.min(2.5, Math.max(0.5, c.artScale))
          : 1,
    })),
  }))
}

function normalizeCustomLayout(raw: Partial<CustomLayoutDef> | null | undefined): CustomLayoutDef | null {
  if (!raw || !Array.isArray(raw.slots) || raw.slots.length === 0) return null
  return {
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name ?? '自定义布局',
    description: raw.description ?? '',
    width: raw.width ?? 1920,
    height: raw.height ?? 1080,
    header: raw.header ?? { x: 40, y: 18, w: 1840, h: 88 },
    slots: raw.slots,
    theme: raw.theme,
    recommendedHeaderStyleId: raw.recommendedHeaderStyleId,
    recommendedExtraCharStyleId: raw.recommendedExtraCharStyleId,
    recommendedExtraCharLayout: raw.recommendedExtraCharLayout,
    recommendedPlayerIdStyleId: raw.recommendedPlayerIdStyleId,
    recommendedPlayerIdLayout: raw.recommendedPlayerIdLayout,
    recommendedThemeConfig: normalizeThemeConfig(raw.recommendedThemeConfig),
    headerStyleId: raw.headerStyleId,
    headerImageUrl: raw.headerImageUrl ?? '',
    titleFontId: raw.titleFontId,
    playerFontId: raw.playerFontId,
    rankFontId: raw.rankFontId,
    defaultBoxStyle: raw.defaultBoxStyle ? normalizeBoxStyle(raw.defaultBoxStyle) : undefined,
    recommendedAccent:
      typeof raw.recommendedAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.recommendedAccent)
        ? raw.recommendedAccent
        : undefined,
    backgroundImageDataUrl:
      raw.backgroundImageDataUrl ?? raw.previewBackgroundDataUrl ?? '',
    background: raw.background ?? '#0a0b10',
    backgroundDim: typeof raw.backgroundDim === 'number' ? raw.backgroundDim : 0.45,
    customLogoDataUrl:
      typeof raw.customLogoDataUrl === 'string' &&
      raw.customLogoDataUrl !== '/brand/custom-logo.png' &&
      raw.customLogoDataUrl !== '/brand/ebifc-logo.png'
        ? raw.customLogoDataUrl
        : '',
    previewBackgroundDataUrl: raw.previewBackgroundDataUrl ?? '',
    headerTexts: raw.headerTexts,
    headerTextMode:
      raw.headerTextMode === 'theme' ? 'theme' : raw.headerTextMode === 'custom' ? 'custom' : undefined,
    slotTextMode:
      raw.slotTextMode === 'theme' ? 'theme' : raw.slotTextMode === 'custom' ? 'custom' : undefined,
    creditsText: raw.creditsText,
    basedOn: raw.basedOn,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}

function normalizeLayoutOverrides(
  raw: Partial<LayoutFieldOverrides> | undefined,
): Top8Doc['layoutOverrides'] {
  if (!raw || typeof raw !== 'object') return undefined
  const out: NonNullable<Top8Doc['layoutOverrides']> = {}
  if (raw.background === true) out.background = true
  if (raw.extraChar === true) out.extraChar = true
  if (raw.playerId === true) out.playerId = true
  return Object.keys(out).length > 0 ? out : undefined
}

export function normalizeLoadedDoc(parsed: Partial<Top8Doc>, gameCode: string): Top8Doc {
  const customLayout = normalizeCustomLayout(parsed.customLayout)
  const layoutIdRaw = parsed.layoutId
  const layoutId =
    layoutIdRaw === 'custom' && customLayout
      ? 'custom'
      : layoutIdRaw === 'podium' ||
          layoutIdRaw === 'squares' ||
          layoutIdRaw === 'tokon' ||
          layoutIdRaw === 'paragon' ||
          layoutIdRaw === 'animefgc' ||
          layoutIdRaw === 'ebifc'
        ? layoutIdRaw
        : 'classic'
  return {
    ...defaultDoc(gameCode),
    ...parsed,
    gameCode,
    numEntrants:
      parsed.numEntrants != null && parsed.numEntrants !== ''
        ? String(parsed.numEntrants)
        : '',
    posterLocale: parsed.posterLocale === 'en' ? 'en' : 'zh',
    headerStyleId:
      parsed.headerStyleId === 'banner' ||
      parsed.headerStyleId === 'hero' ||
      parsed.headerStyleId === 'bottom' ||
      parsed.headerStyleId === 'tokon' ||
        parsed.headerStyleId === 'paragon' ||
        parsed.headerStyleId === 'animefgc' ||
        parsed.headerStyleId === 'ebifc'
        ? parsed.headerStyleId
        : 'compact',
    extraCharStyleId:
      parsed.extraCharStyleId === 'sideStack' || parsed.extraCharStyleId === 'custom'
        ? parsed.extraCharStyleId
        : 'bottomRow',
    extraCharLayout:
      parsed.extraCharLayout && typeof parsed.extraCharLayout === 'object'
        ? (parsed.extraCharLayout as Top8Doc['extraCharLayout'])
        : undefined,
    playerIdStyleId:
      parsed.playerIdStyleId === 'inCard' ||
      parsed.playerIdStyleId === 'hang' ||
      parsed.playerIdStyleId === 'custom'
        ? parsed.playerIdStyleId
        : 'overlay',
    playerIdLayout:
      parsed.playerIdLayout && typeof parsed.playerIdLayout === 'object'
        ? (parsed.playerIdLayout as Top8Doc['playerIdLayout'])
        : undefined,
    titleFontId: isValidFontId(parsed.titleFontId) ? parsed.titleFontId! : DEFAULT_TITLE_FONT,
    playerFontId: isValidFontId(parsed.playerFontId) ? parsed.playerFontId! : DEFAULT_PLAYER_FONT,
    rankFontId: isValidFontId(parsed.rankFontId) ? parsed.rankFontId! : DEFAULT_RANK_FONT,
    defaultBoxStyle: normalizeBoxStyle(parsed.defaultBoxStyle),
    layoutId,
    customLayout: layoutId === 'custom' ? customLayout : null,
    backgroundImageDataUrl: parsed.backgroundImageDataUrl ?? '',
    backgroundDim: typeof parsed.backgroundDim === 'number' ? parsed.backgroundDim : 0.45,
    playerBoxOpacity: typeof parsed.playerBoxOpacity === 'number' ? parsed.playerBoxOpacity : 1,
    showExtraCharNames: parsed.showExtraCharNames !== false,
    globalArtScale:
      typeof parsed.globalArtScale === 'number' && Number.isFinite(parsed.globalArtScale)
        ? Math.min(2.5, Math.max(0.5, parsed.globalArtScale))
        : 1,
    layoutOverrides: normalizeLayoutOverrides(parsed.layoutOverrides),
    players: normalizePlayers(parsed.players),
    logoDataUrl: stripAutoBrandLogo(parsed.logoDataUrl),
  }
}

/** 清除历史版本静默写入的品牌默认 Logo */
function stripAutoBrandLogo(src: string | undefined): string {
  if (!src) return ''
  if (src === '/brand/custom-logo.png' || src === '/brand/ebifc-logo.png') return ''
  return src
}

function readDocFromLocalStorage(gameCode: string): Top8Doc | null {
  try {
    const raw = localStorage.getItem(docsLocalKey(gameCode))
    if (raw) return normalizeLoadedDoc(JSON.parse(raw) as Partial<Top8Doc>, gameCode)
    const legacy = localStorage.getItem(LEGACY_DOC_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<Top8Doc>
      if ((parsed.gameCode ?? 'sf6') === gameCode) {
        return normalizeLoadedDoc(parsed, gameCode)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeDocToLocalStorage(doc: Top8Doc): string | null {
  try {
    localStorage.setItem(docsLocalKey(doc.gameCode), JSON.stringify(doc))
    return null
  } catch {
    return '本地存储空间不足，自定义大图可能无法完整保存。可先清除部分上传图后重试。'
  }
}

/** 按游戏加载海报文档（优先 `saves/{gameCode}/doc.json`） */
export async function loadDocForGame(gameCode: string): Promise<Top8Doc> {
  try {
    const res = await fetch(saveApiUrl(gameCode, 'doc'))
    if (res.ok) {
      const parsed = (await res.json()) as Partial<Top8Doc>
      const doc = normalizeLoadedDoc(parsed, gameCode)
      writeDocToLocalStorage(doc)
      return doc
    }
  } catch {
    /* dev server offline */
  }
  return readDocFromLocalStorage(gameCode) ?? defaultDoc(gameCode)
}

/** @deprecated 请使用 loadDocForGame */
export function loadDoc(): Top8Doc {
  return readDocFromLocalStorage('sf6') ?? defaultDoc('sf6')
}

/** 保存到 `saves/{gameCode}/doc.json` 并镜像到 localStorage */
export async function saveDoc(doc: Top8Doc): Promise<string | null> {
  const warn = writeDocToLocalStorage(doc)
  try {
    await fetch(saveApiUrl(doc.gameCode, 'doc'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
  } catch {
    /* offline — localStorage only */
  }
  return warn
}
