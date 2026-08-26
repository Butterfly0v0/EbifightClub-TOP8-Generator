import type {
  CustomLayoutDef,
  ExtraCharLayoutConfig,
  ExtraCharStyleId,
  LayoutTextRenderMode,
  PlayerIdLayoutConfig,
  PlayerIdStyleId,
  Top8Doc,
} from '../types'
import { normalizeBoxStyle } from './boxThemes'
import { DEFAULT_PLAYER_FONT, DEFAULT_RANK_FONT, DEFAULT_TITLE_FONT } from './fonts'

/** 品牌自定义 Logo 路径（仅用户主动选择/上传时使用，勿作静默默认） */
export const DEFAULT_CUSTOM_LOGO_URL = '/brand/custom-logo.png'
export const BRAND_EBIFC_LOGO_URL = '/brand/ebifc-logo.png'

export type LayoutFieldOverrides = {
  background?: boolean
  extraChar?: boolean
  playerId?: boolean
}

export type EffectivePosterSettings = {
  backgroundImageDataUrl: string
  background: string
  backgroundDim: number
  extraCharStyleId: ExtraCharStyleId
  extraCharLayout?: ExtraCharLayoutConfig
  playerIdStyleId: PlayerIdStyleId
  playerIdLayout?: PlayerIdLayoutConfig
  logoDataUrl: string
}

function layoutDef(doc: Top8Doc): CustomLayoutDef | null {
  return doc.layoutId === 'custom' ? doc.customLayout : null
}

/** 合并布局默认值与文档值；用户在主界面改过且标记 override 的字段以 doc 为准 */
export function effectivePosterSettings(doc: Top8Doc): EffectivePosterSettings {
  const layout = layoutDef(doc)
  const ov = doc.layoutOverrides ?? {}

  const backgroundImageDataUrl = ov.background
    ? doc.backgroundImageDataUrl
    : layout?.backgroundImageDataUrl ?? doc.backgroundImageDataUrl ?? ''

  const background = ov.background
    ? doc.background
    : layout?.background ?? doc.background ?? '#0a0b10'

  const backgroundDim = ov.background
    ? doc.backgroundDim
    : layout?.backgroundDim ?? doc.backgroundDim ?? 0.45

  const extraCharStyleId = ov.extraChar
    ? doc.extraCharStyleId
    : layout?.recommendedExtraCharStyleId ?? doc.extraCharStyleId ?? 'bottomRow'

  const extraCharLayout = ov.extraChar
    ? doc.extraCharLayout
    : layout?.recommendedExtraCharLayout ?? doc.extraCharLayout

  const playerIdStyleId = ov.playerId
    ? doc.playerIdStyleId
    : layout?.recommendedPlayerIdStyleId ?? doc.playerIdStyleId ?? 'overlay'

  const playerIdLayout = ov.playerId
    ? doc.playerIdLayout
    : layout?.recommendedPlayerIdLayout ?? doc.playerIdLayout

  const logoDataUrl = doc.logoDataUrl || layout?.customLogoDataUrl || ''

  return {
    backgroundImageDataUrl,
    background,
    backgroundDim,
    extraCharStyleId,
    extraCharLayout,
    playerIdStyleId,
    playerIdLayout,
    logoDataUrl,
  }
}

function slotHasCustomTextLayout(layout: CustomLayoutDef): boolean {
  return layout.slots.some((s) => {
    const tl = s.textLayout
    return Boolean(tl?.name || tl?.twitter || tl?.roster || (tl?.extras?.length ?? 0) > 0)
  })
}

/** 解析自定义布局的文字绘制模式（兼容无此字段的旧布局） */
export function resolveLayoutTextModes(doc: Top8Doc): {
  header: LayoutTextRenderMode
  slot: LayoutTextRenderMode
} {
  const layout = doc.layoutId === 'custom' ? doc.customLayout : null
  if (!layout) {
    return { header: 'theme', slot: 'theme' }
  }
  const header: LayoutTextRenderMode =
    layout.headerTextMode ??
    (layout.headerTexts && Object.keys(layout.headerTexts).length > 0 ? 'custom' : 'theme')
  const slot: LayoutTextRenderMode =
    layout.slotTextMode ?? (slotHasCustomTextLayout(layout) ? 'custom' : 'theme')
  return { header, slot }
}

export function layoutSettingsFromDef(layout: CustomLayoutDef): Pick<
  Top8Doc,
  | 'backgroundImageDataUrl'
  | 'background'
  | 'backgroundDim'
  | 'extraCharStyleId'
  | 'extraCharLayout'
  | 'playerIdStyleId'
  | 'playerIdLayout'
  | 'logoDataUrl'
  | 'layoutOverrides'
  | 'headerStyleId'
  | 'titleFontId'
  | 'playerFontId'
  | 'rankFontId'
  | 'defaultBoxStyle'
  | 'playerBoxOpacity'
  | 'globalArtScale'
  | 'showCredits'
  | 'showExtraCharNames'
  | 'accent'
> {
  return {
    backgroundImageDataUrl: layout.backgroundImageDataUrl ?? '',
    background: layout.background ?? '#0a0b10',
    backgroundDim: layout.backgroundDim ?? 0.45,
    extraCharStyleId: layout.recommendedExtraCharStyleId ?? 'bottomRow',
    extraCharLayout: layout.recommendedExtraCharLayout,
    playerIdStyleId: layout.recommendedPlayerIdStyleId ?? 'overlay',
    playerIdLayout: layout.recommendedPlayerIdLayout,
    logoDataUrl: layout.customLogoDataUrl ?? '',
    layoutOverrides: {},
    headerStyleId: layout.headerStyleId ?? layout.recommendedHeaderStyleId ?? 'compact',
    titleFontId: layout.titleFontId ?? DEFAULT_TITLE_FONT,
    playerFontId: layout.playerFontId ?? DEFAULT_PLAYER_FONT,
    rankFontId: layout.rankFontId ?? DEFAULT_RANK_FONT,
    defaultBoxStyle: normalizeBoxStyle(layout.defaultBoxStyle),
    playerBoxOpacity: 1,
    globalArtScale: 1,
    showCredits: true,
    showExtraCharNames: true,
    accent:
      typeof layout.recommendedAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(layout.recommendedAccent)
        ? layout.recommendedAccent
        : '#ff4d2e',
  }
}
