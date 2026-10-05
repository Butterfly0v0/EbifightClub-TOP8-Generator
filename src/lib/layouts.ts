import { DEFAULT_BOX_STYLE, normalizeBoxStyle } from './boxThemes'
import { DEFAULT_PLAYER_FONT, DEFAULT_RANK_FONT, DEFAULT_TITLE_FONT } from './fonts'
import { defaultThemeConfigForTheme } from './themeConfig'
import { defaultHeaderRegion } from './headers'
import {
  defaultCreditsText,
  defaultHeaderTexts,
  defaultSlotTextLayout,
} from './layoutElements'
import type { BuiltInLayoutId, CustomLayoutDef, Layout, Top8Doc } from '../types'

const W = 1920
const H = 1080

export const LAYOUTS: Record<BuiltInLayoutId, Layout> = {
  classic: {
    id: 'classic',
    name: '经典 TOP8',
    description: '冠军大图在左，2–4 名叠在右侧，5–8 名贴底',
    width: W,
    height: H,
    header: { x: 40, y: 18, w: 1840, h: 88 },
    recommendedHeaderStyleId: 'compact',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'overlay',
    recommendedTitleFontId: 'noto-sans',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'bebas',
    recommendedAccent: '#ff4d2e',
    recommendedBackground: '#0b0c11',
    recommendedBackgroundDim: 0.45,
    recommendedPlayerBoxOpacity: 1,
    recommendedGlobalArtScale: 1,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    slots: [
      slot(0, 36, 116, 900, 686, 0.48, 0.34, 42, 92, 16),
      slot(1, 952, 116, 932, 218, 0.5, 0.32, 28, 48, 12),
      slot(2, 952, 350, 932, 218, 0.5, 0.32, 28, 48, 12),
      slot(3, 952, 584, 932, 218, 0.5, 0.32, 28, 48, 12),
      slot(4, 36, 822, 456, 214, 0.5, 0.34, 24, 40, 12),
      slot(5, 508, 822, 456, 214, 0.5, 0.34, 24, 40, 12),
      slot(6, 980, 822, 456, 214, 0.5, 0.34, 24, 40, 12),
      slot(7, 1452, 822, 432, 214, 0.5, 0.34, 24, 40, 12),
    ],
  },
  podium: {
    id: 'podium',
    name: '领奖台',
    description: '2nd | 1st | 3rd 领奖台，下面一排放 4–8 名',
    width: W,
    height: H,
    header: { x: 40, y: 18, w: 1840, h: 88 },
    recommendedHeaderStyleId: 'compact',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'overlay',
    recommendedTitleFontId: 'oswald',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'bebas',
    recommendedAccent: '#f0b429',
    recommendedBackground: '#090a10',
    recommendedBackgroundDim: 0.42,
    recommendedPlayerBoxOpacity: 1,
    recommendedGlobalArtScale: 1,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    slots: [
      slot(1, 36, 200, 560, 560, 0.5, 0.32, 32, 64, 14),
      slot(0, 616, 116, 688, 644, 0.5, 0.32, 40, 88, 16),
      slot(2, 1324, 200, 560, 560, 0.5, 0.32, 32, 64, 14),
      slot(3, 36, 784, 360, 252, 0.5, 0.34, 22, 36, 12),
      slot(4, 412, 784, 360, 252, 0.5, 0.34, 22, 36, 12),
      slot(5, 788, 784, 360, 252, 0.5, 0.34, 22, 36, 12),
      slot(6, 1164, 784, 360, 252, 0.5, 0.34, 22, 36, 12),
      slot(7, 1540, 784, 344, 252, 0.5, 0.34, 22, 36, 12),
    ],
  },
  squares: {
    id: 'squares',
    name: '方格 TOP8',
    description: '冠军大方块在左，2–4 名与 5–8 名在右侧两行正方形排列',
    width: W,
    height: H,
    header: { x: 40, y: 18, w: 1840, h: 88 },
    recommendedHeaderStyleId: 'hero',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'overlay',
    recommendedTitleFontId: 'outfit',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'oswald',
    recommendedAccent: '#6b9fff',
    recommendedBackground: '#0c0e18',
    recommendedBackgroundDim: 0.4,
    recommendedDefaultBoxStyle: {
      theme: 'rank',
    },
    recommendedPlayerBoxOpacity: 0.92,
    recommendedGlobalArtScale: 1,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    slots: squaresLayout(),
  },
  tokon: {
    id: 'tokon',
    name: '斗魂 TOP8',
    description: '参考漫威斗魂周赛：左侧冠军，右上 2–4 名、右下 5–8 名，搭配底栏标题',
    width: W,
    height: H,
    header: { x: 0, y: 932, w: W, h: 148 },
    theme: 'tokon',
    recommendedHeaderStyleId: 'tokon',
    recommendedExtraCharStyleId: 'sideStack',
    recommendedPlayerIdStyleId: 'inCard',
    recommendedTitleFontId: 'oswald',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'bebas',
    recommendedAccent: '#e8c547',
    recommendedBackground: '#07080f',
    recommendedBackgroundDim: 0.52,
    recommendedDefaultBoxStyle: {
      theme: 'accent',
      fillColor: '#12151f',
      fillOpacity: 0.9,
      borderWidth: 2,
      borderOpacity: 0.5,
    },
    recommendedPlayerBoxOpacity: 0.96,
    recommendedGlobalArtScale: 1,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    slots: tokonLayout(),
  },
  paragon: {
    id: 'paragon',
    name: '竞技方格（仿Paragonline布局）',
    description: '全宽网格：左侧冠军、右上 2–4 名、右下 5–8 名，白底栏 + 红名条',
    width: W,
    height: H,
    header: { x: 0, y: 932, w: W, h: 148 },
    theme: 'paragon',
    recommendedHeaderStyleId: 'paragon',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'inCard',
    recommendedAccent: '#d91e2a',
    recommendedBackground: '#0e1118',
    recommendedDefaultBoxStyle: {
      theme: 'accent',
      fillColor: '#141c2e',
      fillOpacity: 1,
      borderWidth: 0,
    },
    recommendedBackgroundDim: 0.35,
    recommendedPlayerBoxOpacity: 1,
    recommendedGlobalArtScale: 1.02,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    recommendedTitleFontId: 'anton',
    recommendedPlayerFontId: 'outfit',
    recommendedRankFontId: 'bebas',
    slots: paragonLayout(),
  },
  animefgc: {
    id: 'animefgc',
    name: 'AnimeFGC（仿AnimeFGC布局）',
    description: '左侧冠军大图 + 右侧 2–8 名竖排列表，顶部赛事标题',
    width: W,
    height: H,
    header: { x: 0, y: 0, w: W, h: 100 },
    theme: 'animefgc',
    recommendedHeaderStyleId: 'animefgc',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'overlay',
    recommendedAccent: '#ff5c8a',
    recommendedBackground: '#08080c',
    recommendedDefaultBoxStyle: {
      theme: 'minimal',
      fillOpacity: 0.75,
      borderWidth: 1,
      borderOpacity: 0.35,
    },
    recommendedBackgroundDim: 0.3,
    recommendedPlayerBoxOpacity: 0.78,
    recommendedGlobalArtScale: 1.08,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    recommendedTitleFontId: 'outfit',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'bebas',
    slots: animefgcLayout(),
  },
  ebifc: {
    id: 'ebifc',
    name: '炸虾像素（EbifightClub）',
    description: '像素街机风：方格布局 + 白边贴纸框 + 血条名牌，橙蓝撞色',
    width: W,
    height: H,
    header: { x: 36, y: 20, w: 1848, h: 148 },
    theme: 'ebifc',
    recommendedHeaderStyleId: 'ebifc',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'overlay',
    recommendedTitleFontId: 'black-ops',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'press-start',
    recommendedAccent: '#ff8a3d',
    recommendedBackground: '#0a1220',
    recommendedBackgroundImageDataUrl: '/user-assets/ebi-club-top8-bg-1920x1080.jpg',
    recommendedBackgroundDim: 0.38,
    recommendedDefaultBoxStyle: {
      theme: 'minimal',
      fillColor: '#101828',
      fillOpacity: 0.92,
      borderWidth: 5,
      borderColor: '#ffffff',
      borderOpacity: 1,
    },
    recommendedPlayerBoxOpacity: 0.95,
    recommendedGlobalArtScale: 1.05,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    slots: ebifcLayout(),
  },
  prism: {
    id: 'prism',
    name: '棱镜 TOP8',
    description: '冠军居中聚光，2–5 名环抱两侧，6–8 名底部横条；紫青棱镜切面名牌',
    width: W,
    height: H,
    header: { x: 0, y: 0, w: W, h: 96 },
    theme: 'prism',
    recommendedHeaderStyleId: 'prism',
    recommendedExtraCharStyleId: 'bottomRow',
    recommendedPlayerIdStyleId: 'overlay',
    recommendedTitleFontId: 'outfit',
    recommendedPlayerFontId: 'noto-sans',
    recommendedRankFontId: 'orbitron',
    recommendedAccent: '#a78bfa',
    recommendedBackground: '#08061a',
    recommendedBackgroundDim: 0.48,
    recommendedDefaultBoxStyle: {
      theme: 'accent',
      fillColor: '#0c0a1c',
      fillOpacity: 0.9,
      borderWidth: 2,
      borderOpacity: 0.85,
    },
    recommendedPlayerBoxOpacity: 0.92,
    recommendedGlobalArtScale: 1.1,
    recommendedShowCredits: true,
    recommendedShowExtraCharNames: true,
    slots: prismLayout(),
  },
}

/** 棱镜：冠军居中加冕，2/3 上侧翼、4/5 下侧翼，6–8 底部横条 */
function prismLayout(): Layout['slots'] {
  return [
    slot(0, 564, 80, 792, 748, 0.5, 0.3, 36, 84, 16),
    slot(1, 16, 80, 538, 364, 0.42, 0.32, 24, 48, 12),
    slot(2, 1366, 80, 538, 364, 0.58, 0.32, 24, 48, 12),
    slot(3, 16, 454, 538, 364, 0.42, 0.34, 22, 42, 12),
    slot(4, 1366, 454, 538, 364, 0.58, 0.34, 22, 42, 12),
    slot(5, 16, 840, 623, 212, 0.5, 0.34, 18, 32, 10),
    slot(6, 649, 840, 623, 212, 0.5, 0.34, 18, 32, 10),
    slot(7, 1282, 840, 622, 212, 0.5, 0.34, 18, 32, 10),
  ]
}

/** 炸虾像素：方格 TOP8 结构（左冠军大正方 + 右上 3 / 右下 4） */
function ebifcLayout(): Layout['slots'] {
  const x0 = 36
  const y0 = 184
  const gap = 14
  const sTop = 372
  const sBot = 274
  const sChamp = sTop + gap + sBot
  const xRight = x0 + sChamp + gap

  return [
    slot(0, x0, y0, sChamp, sChamp, 0.48, 0.34, 36, 56, 0),
    slot(1, xRight, y0, sTop, sTop, 0.5, 0.32, 24, 36, 0),
    slot(2, xRight + sTop + gap, y0, sTop, sTop, 0.5, 0.32, 24, 36, 0),
    slot(3, xRight + (sTop + gap) * 2, y0, sTop, sTop, 0.5, 0.32, 24, 36, 0),
    slot(4, xRight, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 28, 0),
    slot(5, xRight + sBot + gap, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 28, 0),
    slot(6, xRight + (sBot + gap) * 2, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 28, 0),
    slot(7, xRight + (sBot + gap) * 3, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 28, 0),
  ]
}

/** AnimeFGC：左冠军全高 + 右 2–8 名横条竖排 */
function animefgcLayout(): Layout['slots'] {
  const listTop = 100
  const gap = 5
  const champW = 1148
  const xRight = champW + gap
  const rightW = W - xRight
  const listH = H - listTop
  const rowCount = 7
  const usable = listH - gap * (rowCount - 1)
  const baseH = Math.floor(usable / rowCount)
  const rem = usable % rowCount

  const rows: Layout['slots'] = [
    slot(0, 0, 0, champW, H, 0.56, 0.30, 26, 76, 0),
  ]
  let y = listTop
  for (let i = 1; i < 8; i++) {
    const rowH = baseH + (i - 1 < rem ? 1 : 0)
    rows.push(slot(i, xRight, y, rightW, rowH, 0.48, 0.28, 17, 26, 2))
    y += rowH + gap
  }
  return rows
}

/** 竞技方格：全宽左冠军 + 右上 3 / 右下 4，细缝拼接 */
function paragonLayout(): Layout['slots'] {
  const gap = 4
  const contentH = 932
  const champW = 768
  const xRight = champW + gap
  const rightW = W - xRight
  const topH = 560
  const botH = contentH - topH - gap
  const topW = Math.floor((rightW - gap * 2) / 3)
  const botW = Math.floor((rightW - gap * 3) / 4)

  return [
    slot(0, 0, 0, champW, contentH, 0.5, 0.32, 24, 56, 0),
    slot(1, xRight, 0, topW, topH, 0.5, 0.32, 20, 40, 0),
    slot(2, xRight + topW + gap, 0, topW, topH, 0.5, 0.32, 20, 40, 0),
    slot(3, xRight + (topW + gap) * 2, 0, topW, topH, 0.5, 0.32, 20, 40, 0),
    slot(4, xRight, topH + gap, botW, botH, 0.5, 0.34, 16, 32, 0),
    slot(5, xRight + botW + gap, topH + gap, botW, botH, 0.5, 0.34, 16, 32, 0),
    slot(6, xRight + (botW + gap) * 2, topH + gap, botW, botH, 0.5, 0.34, 16, 32, 0),
    slot(7, xRight + (botW + gap) * 3, topH + gap, botW, botH, 0.5, 0.34, 16, 32, 0),
  ]
}

/** 斗魂布局：左冠军 + 右上 3 宽条 + 右下 4 宽条 */
function tokonLayout(): Layout['slots'] {
  const x0 = 36
  const y0 = 28
  const gap = 12
  const champW = 660
  const topH = 498
  const botH = 382
  const topW = 384
  const botW = 285
  const xRight = x0 + champW + gap
  const champH = topH + gap + botH

  return [
    slot(0, x0, y0, champW, champH, 0.42, 0.32, 32, 68, 4),
    slot(1, xRight, y0, topW, topH, 0.38, 0.3, 22, 44, 4),
    slot(2, xRight + topW + gap, y0, topW, topH, 0.38, 0.3, 22, 44, 4),
    slot(3, xRight + (topW + gap) * 2, y0, topW, topH, 0.38, 0.3, 22, 44, 4),
    slot(4, xRight, y0 + topH + gap, botW, botH, 0.38, 0.32, 18, 36, 4),
    slot(5, xRight + botW + gap, y0 + topH + gap, botW, botH, 0.38, 0.32, 18, 36, 4),
    slot(6, xRight + (botW + gap) * 2, y0 + topH + gap, botW, botH, 0.38, 0.32, 18, 36, 4),
    slot(7, xRight + (botW + gap) * 3, y0 + topH + gap, botW, botH, 0.38, 0.32, 18, 36, 4),
  ]
}

/** 左侧 1 名 + 右侧上 3 / 下 4，全部为正方形 */
function squaresLayout(): Layout['slots'] {
  const x0 = 36
  const y0 = 116
  const gap = 16
  const sTop = 376
  const sBot = 278
  const sChamp = sTop + gap + sBot
  const xRight = x0 + sChamp + gap

  return [
    slot(0, x0, y0, sChamp, sChamp, 0.48, 0.34, 36, 72, 14),
    slot(1, xRight, y0, sTop, sTop, 0.5, 0.32, 24, 48, 12),
    slot(2, xRight + sTop + gap, y0, sTop, sTop, 0.5, 0.32, 24, 48, 12),
    slot(3, xRight + (sTop + gap) * 2, y0, sTop, sTop, 0.5, 0.32, 24, 48, 12),
    slot(4, xRight, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 40, 10),
    slot(5, xRight + sBot + gap, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 40, 10),
    slot(6, xRight + (sBot + gap) * 2, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 40, 10),
    slot(7, xRight + (sBot + gap) * 3, y0 + sTop + gap, sBot, sBot, 0.5, 0.34, 20, 40, 10),
  ]
}

function slot(
  playerIndex: number,
  x: number,
  y: number,
  w: number,
  h: number,
  focusX: number,
  focusY: number,
  nameSize: number,
  placeSize: number,
  radius: number,
): Layout['slots'][number] {
  return { playerIndex, x, y, w, h, focusX, focusY, nameSize, placeSize, radius }
}

export const LAYOUT_LIST = Object.values(LAYOUTS)

export const BUILT_IN_LAYOUT_IDS = Object.keys(LAYOUTS) as BuiltInLayoutId[]

/** 从内置模板克隆为可编辑的自定义布局 */
export function layoutFromTemplate(
  templateId: BuiltInLayoutId,
  overrides?: Partial<Pick<CustomLayoutDef, 'name' | 'description'>>,
): CustomLayoutDef {
  const src = LAYOUTS[templateId]
  const defaults = builtInLayoutDocDefaults(templateId)
  const now = new Date().toISOString()
  const styleId = src.recommendedHeaderStyleId ?? 'compact'
  const theme = src.theme ?? 'default'
  return {
    id: crypto.randomUUID(),
    name: overrides?.name ?? `${src.name}（自定义）`,
    description: overrides?.description ?? src.description,
    width: src.width,
    height: src.height,
    header: {
      ...defaultHeaderRegion(styleId),
      x: src.header.x,
      y: src.header.y,
      w: src.header.w,
      h: src.header.h,
    },
    slots: src.slots.map((s) => ({
      ...s,
      textLayout: defaultSlotTextLayout(s, theme),
    })),
    theme: src.theme,
    recommendedHeaderStyleId: src.recommendedHeaderStyleId,
    recommendedExtraCharStyleId: src.recommendedExtraCharStyleId,
    recommendedPlayerIdStyleId: src.recommendedPlayerIdStyleId,
    headerStyleId: src.recommendedHeaderStyleId,
    headerTexts: defaultHeaderTexts(
      {
        ...defaultHeaderRegion(styleId, src.width),
        x: src.header.x,
        y: src.header.y,
        w: src.header.w,
        h: src.header.h,
      },
      styleId,
      src.width,
    ),
    creditsText: defaultCreditsText(src.width, src.height, styleId),
    headerTextMode: 'theme',
    slotTextMode: 'theme',
    recommendedThemeConfig: defaultThemeConfigForTheme(src.theme),
    titleFontId: defaults.titleFontId,
    playerFontId: defaults.playerFontId,
    rankFontId: defaults.rankFontId,
    recommendedAccent: defaults.accent ?? src.recommendedAccent ?? '#ff4d2e',
    defaultBoxStyle: defaults.defaultBoxStyle ?? { ...DEFAULT_BOX_STYLE },
    previewExtraCount: 2,
    basedOn: templateId,
    createdAt: now,
    updatedAt: now,
    textCoordsRelative: true,
    customLogoDataUrl: defaults.logoDataUrl ?? src.recommendedCustomLogoUrl ?? '',
    background: defaults.background,
    backgroundDim: defaults.backgroundDim,
    backgroundImageDataUrl: defaults.backgroundImageDataUrl ?? src.recommendedBackgroundImageDataUrl,
  }
}

export function emptyCustomLayout(): CustomLayoutDef {
  const now = new Date().toISOString()
  const slots = Array.from({ length: 8 }, (_, i) =>
    slot(i, 36 + (i % 4) * 460, 116 + Math.floor(i / 4) * 460, 440, 420, 0.5, 0.32, 28, 48, 12),
  )
  return {
    id: crypto.randomUUID(),
    name: '空白布局',
    description: '从空白画布开始设计',
    width: W,
    height: H,
    header: defaultHeaderRegion('compact'),
    previewExtraCount: 2,
    slots: slots.map((s) => ({ ...s, textLayout: defaultSlotTextLayout(s) })),
    headerTexts: defaultHeaderTexts(defaultHeaderRegion('compact', W), 'compact', W),
    headerTextMode: 'custom',
    slotTextMode: 'custom',
    creditsText: defaultCreditsText(W, H, 'compact'),
    titleFontId: DEFAULT_TITLE_FONT,
    playerFontId: DEFAULT_PLAYER_FONT,
    rankFontId: DEFAULT_RANK_FONT,
    recommendedAccent: '#ff4d2e',
    defaultBoxStyle: { ...DEFAULT_BOX_STYLE },
    createdAt: now,
    updatedAt: now,
    textCoordsRelative: true,
    customLogoDataUrl: '',
    background: '#0a0b10',
    backgroundDim: 0.45,
  }
}

/** 解析自定义布局应写入海报的强调色（含旧布局 basedOn 回退） */
export function resolveLayoutAccent(layout: CustomLayoutDef): string {
  if (typeof layout.recommendedAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(layout.recommendedAccent)) {
    return layout.recommendedAccent
  }
  if (layout.basedOn) {
    const fromTemplate = LAYOUTS[layout.basedOn]?.recommendedAccent
    if (fromTemplate) return fromTemplate
  }
  return '#ff4d2e'
}

/** 内置布局模板的完整海报默认参数（切换模板时一次性恢复） */
export function builtInLayoutDocDefaults(id: BuiltInLayoutId): Partial<Top8Doc> {
  const layout = LAYOUTS[id]
  return {
    layoutId: id,
    customLayout: null,
    layoutOverrides: {},
    backgroundImageDataUrl: layout.recommendedBackgroundImageDataUrl ?? '',
    headerStyleId: layout.recommendedHeaderStyleId ?? 'compact',
    extraCharStyleId: layout.recommendedExtraCharStyleId ?? 'bottomRow',
    extraCharLayout: layout.recommendedExtraCharLayout,
    playerIdStyleId: layout.recommendedPlayerIdStyleId ?? 'overlay',
    playerIdLayout: layout.recommendedPlayerIdLayout,
    titleFontId: layout.recommendedTitleFontId ?? DEFAULT_TITLE_FONT,
    playerFontId: layout.recommendedPlayerFontId ?? DEFAULT_PLAYER_FONT,
    rankFontId: layout.recommendedRankFontId ?? DEFAULT_RANK_FONT,
    accent: layout.recommendedAccent ?? '#ff4d2e',
    background: layout.recommendedBackground ?? '#0b0c11',
    backgroundDim: layout.recommendedBackgroundDim ?? 0.45,
    defaultBoxStyle: normalizeBoxStyle(layout.recommendedDefaultBoxStyle ?? DEFAULT_BOX_STYLE),
    playerBoxOpacity: layout.recommendedPlayerBoxOpacity ?? 1,
    globalArtScale: layout.recommendedGlobalArtScale ?? 1,
    showCredits: layout.recommendedShowCredits ?? true,
    showExtraCharNames: layout.recommendedShowExtraCharNames ?? true,
  }
}

/** 根据文档解析实际使用的布局 */
export function resolveDocLayout(doc: Top8Doc): Layout {
  if (doc.layoutId === 'custom' && doc.customLayout) {
    return { ...doc.customLayout, id: 'custom' }
  }
  const builtIn = doc.layoutId as BuiltInLayoutId
  return LAYOUTS[builtIn] ?? LAYOUTS.classic
}

export function layoutDisplayName(doc: Top8Doc): string {
  if (doc.layoutId === 'custom' && doc.customLayout) return doc.customLayout.name
  const builtIn = doc.layoutId as BuiltInLayoutId
  return LAYOUTS[builtIn]?.name ?? '经典 TOP8'
}
