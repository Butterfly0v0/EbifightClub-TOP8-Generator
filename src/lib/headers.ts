import type { HeaderRegion, HeaderStyleId, HeaderLayoutTexts, Top8Doc } from '../types'
import { fontFamily } from './fonts'
import {
  drawLayoutImageBox,
  drawLayoutTextBox,
  offsetImageBox,
  offsetTextBox,
  resolveCreditsText,
  resolveTextBoxContent,
  type HeaderTextKey,
} from './layoutElements'

export type { HeaderRegion } from '../types'

export type HeaderStyle = {
  id: HeaderStyleId
  name: string
  description: string
  /** 选手区可用范围上沿 */
  contentTop: number
  /** 选手区可用范围下沿 */
  contentBottom: number
}

export const HEADER_STYLES: Record<HeaderStyleId, HeaderStyle> = {
  compact: {
    id: 'compact',
    name: '紧凑顶栏',
    description: '顶部小圆角栏，选手区自动垂直居中',
    contentTop: 116,
    contentBottom: 1068,
  },
  banner: {
    id: 'banner',
    name: '顶部横幅',
    description: '全宽加高横幅，强调赛事名称',
    contentTop: 168,
    contentBottom: 1068,
  },
  hero: {
    id: 'hero',
    name: '大标题',
    description: '顶部大标题区，适合方格等下方留白较多的布局',
    contentTop: 248,
    contentBottom: 1068,
  },
  bottom: {
    id: 'bottom',
    name: '底部栏',
    description: '标题移到底部，上方留给选手展示',
    contentTop: 36,
    contentBottom: 936,
  },
  tokon: {
    id: 'tokon',
    name: '斗魂底栏',
    description: '全宽底栏：TOP 8 大字 + 赛事信息 + 右侧 Logo，搭配斗魂布局',
    contentTop: 28,
    contentBottom: 920,
  },
  paragon: {
    id: 'paragon',
    name: '竞技白底栏',
    description: '全宽白底栏：TOP 8 大字 + 赛事标签 + 日期人数，搭配竞技方格布局',
    contentTop: 0,
    contentBottom: 932,
  },
  animefgc: {
    id: 'animefgc',
    name: 'AnimeFGC 顶栏',
    description: '顶部半透明栏：赛事标题居中 + 左右 Logo，搭配 AnimeFGC 布局',
    contentTop: 0,
    contentBottom: 1080,
  },
  ebifc: {
    id: 'ebifc',
    name: '炸虾贴纸顶栏',
    description: '白边像素贴纸栏：TOP 8 徽章 + 橙蓝标题分层 + Logo，搭配炸虾像素布局',
    contentTop: 184,
    contentBottom: 1060,
  },
}

export const HEADER_STYLE_LIST = Object.values(HEADER_STYLES)

export const DEFAULT_HEADER_BG = '#08080c'

/** 各标题栏样式的默认区域与视觉参数 */
export function defaultHeaderRegion(styleId: HeaderStyleId, width = 1920): HeaderRegion {
  switch (styleId) {
    case 'banner':
      return {
        x: 0,
        y: 0,
        w: width,
        h: 148,
        backgroundOpacity: 0.78,
        backgroundColor: DEFAULT_HEADER_BG,
        borderRadius: 0,
        accentBarHeight: 4,
      }
    case 'hero':
      return {
        x: 40,
        y: 24,
        w: width - 80,
        h: 200,
        backgroundOpacity: 0.62,
        backgroundColor: DEFAULT_HEADER_BG,
        borderRadius: 16,
        accentBarHeight: 0,
      }
    case 'bottom':
      return {
        x: 40,
        y: 952,
        w: width - 80,
        h: 88,
        backgroundOpacity: 0.55,
        backgroundColor: DEFAULT_HEADER_BG,
        borderRadius: 14,
        accentBarHeight: 0,
      }
    case 'tokon':
      return {
        x: 0,
        y: 932,
        w: width,
        h: 148,
        backgroundOpacity: 0.94,
        backgroundColor: '#060812',
        borderRadius: 0,
        accentBarHeight: 2,
      }
    case 'paragon':
      return {
        x: 0,
        y: 932,
        w: width,
        h: 148,
        backgroundOpacity: 1,
        backgroundColor: '#f4f4f6',
        borderRadius: 0,
        accentBarHeight: 0,
      }
    case 'animefgc':
      return {
        x: 0,
        y: 0,
        w: width,
        h: 100,
        backgroundOpacity: 0,
        backgroundColor: '#000000',
        borderRadius: 0,
        accentBarHeight: 0,
      }
    case 'ebifc':
      return {
        x: 36,
        y: 20,
        w: width - 72,
        h: 148,
        backgroundOpacity: 1,
        backgroundColor: '#121a2a',
        borderRadius: 0,
        accentBarHeight: 0,
        borderWidth: 6,
        borderColor: '#ffffff',
      }
    default:
      return {
        x: 40,
        y: 18,
        w: width - 80,
        h: 88,
        backgroundOpacity: 0.55,
        backgroundColor: DEFAULT_HEADER_BG,
        borderRadius: 14,
        accentBarHeight: 0,
      }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight = '700',
  family = '"Noto Sans SC", "Segoe UI", sans-serif',
) {
  let s = size
  ctx.font = `${weight} ${s}px ${family}`
  while (s > 12 && ctx.measureText(text).width > maxWidth) {
    s -= 1
    ctx.font = `${weight} ${s}px ${family}`
  }
  return s
}

function formatEntrants(raw: string | undefined, locale: Top8Doc['posterLocale']): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return t
  const count = Math.round(n)
  return locale === 'en' ? `${count} participants` : `${count} 参赛者`
}

type HeaderDrawContext = {
  ctx: CanvasRenderingContext2D
  doc: Top8Doc
  width: number
  accent: [number, number, number]
  customLogo?: HTMLImageElement
  gameLogo?: HTMLImageElement
}

function fitImageSize(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  if (img.width <= 0 || img.height <= 0) return { w: maxW, h: maxH }
  const ratio = img.width / img.height
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w, h }
}

function drawLogos(
  { ctx, customLogo, gameLogo }: HeaderDrawContext,
  region: { x: number; y: number; w: number; h: number },
  titleX: number,
  limits?: { customMaxW?: number; gameMaxW?: number; pad?: number },
): number {
  const pad = limits?.pad ?? 14
  const customMaxW = limits?.customMaxW ?? 280
  const gameMaxW = limits?.gameMaxW ?? 220
  let x = titleX
  if (customLogo) {
    const { w, h } = fitImageSize(customLogo, customMaxW, region.h - pad * 2)
    const y = region.y + (region.h - h) / 2
    ctx.drawImage(customLogo, x, y, w, h)
    x += w + 20
  }
  if (gameLogo) {
    const { w, h } = fitImageSize(gameLogo, gameMaxW, region.h - pad * 2)
    const y = region.y + (region.h - h) / 2
    ctx.drawImage(gameLogo, region.x + region.w - w - pad, y, w, h)
  }
  return x
}

function drawTitleLines(
  { ctx, doc, accent }: HeaderDrawContext,
  region: { x: number; y: number; w: number; h: number },
  titleX: number,
  titleSize: number,
  metaSize: number,
  titleY: number,
  metaY: number,
) {
  const [ar, ag, ab] = accent
  const title = doc.tournamentName || 'EbifightClub TOP 8'
  const titleFont = fontFamily(doc.titleFontId)
  const meta = [doc.subtitle, formatEntrants(doc.numEntrants, doc.posterLocale ?? 'zh'), doc.date]
    .filter(Boolean)
    .join('  ·  ')

  ctx.fillStyle = '#f7f3ea'
  ctx.textBaseline = 'top'
  const fittedTitle = fitText(ctx, title, region.w * 0.62, titleSize, '800', titleFont)
  ctx.font = `800 ${fittedTitle}px ${titleFont}`
  ctx.fillText(title, titleX, titleY)

  ctx.fillStyle = `rgb(${ar},${ag},${ab})`
  ctx.font = `600 ${metaSize}px ${titleFont}`
  ctx.fillText(meta || 'TOP 8', titleX, metaY)
}

function drawCompactHeader(h: HeaderDrawContext) {
  const region = { x: 40, y: 18, w: h.width - 80, h: 88 }
  h.ctx.fillStyle = 'rgba(8,8,12,0.55)'
  roundRect(h.ctx, region.x, region.y, region.w, region.h, 14)
  h.ctx.fill()
  const titleX = drawLogos(h, region, region.x + 22)
  drawTitleLines(h, region, titleX, 40, 24, region.y + 12, region.y + 54)
}

function drawBannerHeader(h: HeaderDrawContext) {
  const region = { x: 0, y: 0, w: h.width, h: 148 }
  const [ar, ag, ab] = h.accent
  h.ctx.fillStyle = 'rgba(8,8,12,0.78)'
  h.ctx.fillRect(region.x, region.y, region.w, region.h)
  h.ctx.fillStyle = `rgb(${ar},${ag},${ab})`
  h.ctx.fillRect(region.x, region.y + region.h - 4, region.w, 4)
  const titleX = drawLogos(h, region, region.x + 40)
  drawTitleLines(h, region, titleX, 46, 26, region.y + 28, region.y + 88)
}

function drawHeroHeader(h: HeaderDrawContext) {
  const region = { x: 40, y: 24, w: h.width - 80, h: 200 }
  const [ar, ag, ab] = h.accent
  h.ctx.fillStyle = 'rgba(8,8,12,0.62)'
  roundRect(h.ctx, region.x, region.y, region.w, region.h, 16)
  h.ctx.fill()
  h.ctx.fillStyle = `rgb(${ar},${ag},${ab})`
  h.ctx.fillRect(region.x, region.y + 18, 5, region.h - 36)
  const titleX = drawLogos(h, region, region.x + 28, {
    customMaxW: 420,
    gameMaxW: 400,
    pad: 12,
  })
  drawTitleLines(h, region, titleX, 52, 28, region.y + 36, region.y + 118)
}

function drawBottomHeader(h: HeaderDrawContext) {
  const region = { x: 40, y: 952, w: h.width - 80, h: 88 }
  const [ar, ag, ab] = h.accent
  h.ctx.fillStyle = 'rgba(8,8,12,0.55)'
  roundRect(h.ctx, region.x, region.y, region.w, region.h, 14)
  h.ctx.fill()
  h.ctx.fillStyle = `rgba(${ar},${ag},${ab},0.35)`
  h.ctx.fillRect(region.x + 18, region.y + 12, region.w - 36, 1)
  const titleX = drawLogos(h, region, region.x + 22)
  drawTitleLines(h, region, titleX, 38, 22, region.y + 18, region.y + 58)
}

function drawHexLogoFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  img: HTMLImageElement,
  accent: [number, number, number],
) {
  const [ar, ag, ab] = accent
  const cx = x + size / 2
  const cy = y + size / 2
  const r = size * 0.46
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const px = cx + r * Math.cos(a)
    const py = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.25)`
  ctx.fill()
  ctx.strokeStyle = `rgb(${ar},${ag},${ab})`
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.clip()
  const pad = size * 0.12
  const inner = size - pad * 2
  const { w, h } = fitImageSize(img, inner, inner)
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h)
  ctx.restore()
}

function drawTokonHeader(h: HeaderDrawContext) {
  const region = { x: 0, y: 932, w: h.width, h: 148 }
  const [ar, ag, ab] = h.accent
  const { ctx, doc, customLogo, gameLogo } = h
  const locale = doc.posterLocale ?? 'zh'
  const titleFont = fontFamily(doc.titleFontId)
  const rankFont = fontFamily(doc.rankFontId, 'bebas')

  ctx.fillStyle = 'rgba(6,8,18,0.94)'
  ctx.fillRect(region.x, region.y, region.w, region.h)
  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.18)`
  ctx.fillRect(region.x, region.y, region.w, 2)

  let textX = 40
  if (customLogo) {
    drawHexLogoFrame(ctx, 40, region.y + 24, 100, customLogo, h.accent)
    textX = 156
  }

  ctx.fillStyle = '#f7f3ea'
  ctx.font = `italic 800 76px ${rankFont}`
  ctx.textBaseline = 'middle'
  const top8Label = 'TOP 8'
  const top8W = ctx.measureText(top8Label).width
  ctx.fillText(top8Label, textX, region.y + 74)

  const rightX = region.w - 40
  const rightReserve = gameLogo ? 320 : 260
  const infoX = textX + top8W + 28
  const infoMaxW = Math.max(180, rightX - rightReserve - infoX)

  const title = doc.tournamentName || 'EbifightClub TOP 8'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#f7f3ea'
  const titleSize = fitText(ctx, title, infoMaxW, 34, '800', titleFont)
  ctx.font = `800 ${titleSize}px ${titleFont}`
  ctx.fillText(title, infoX, region.y + 28)

  if (doc.subtitle) {
    ctx.fillStyle = '#e8c547'
    const subSize = fitText(ctx, doc.subtitle, infoMaxW, 26, '600', titleFont)
    ctx.font = `italic 600 ${subSize}px ${titleFont}`
    ctx.fillText(doc.subtitle, infoX, region.y + 68)
  }

  const meta = [formatEntrants(doc.numEntrants, locale), doc.date].filter(Boolean).join('  ·  ')
  if (meta) {
    ctx.fillStyle = 'rgba(247,243,234,0.72)'
    ctx.font = `500 16px ${titleFont}`
    ctx.fillText(meta, infoX, region.y + 104)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillStyle = `rgb(${Math.min(255, ar + 40)},${Math.min(255, ag + 60)},${Math.min(255, ab + 80)})`
  ctx.font = '700 13px "Outfit", "Segoe UI", sans-serif'
  ctx.letterSpacing = '2px'
  const resultsLabel = locale === 'en' ? 'TOURNAMENT RESULTS' : '赛事结果'
  ctx.fillText(resultsLabel, rightX, region.y + 36)
  ctx.letterSpacing = '0px'

  if (gameLogo) {
    const { w, lgH } = (() => {
      const fit = fitImageSize(gameLogo, 280, 72)
      return { w: fit.w, lgH: fit.h }
    })()
    ctx.drawImage(gameLogo, rightX - w, region.y + 58, w, lgH)
  } else {
    ctx.fillStyle = '#f7f3ea'
    ctx.font = `800 36px ${rankFont}`
    ctx.textBaseline = 'middle'
    const fallback = (doc.tournamentName || 'TOP 8').slice(0, 16).toUpperCase()
    ctx.fillText(fallback, rightX, region.y + 92)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawParagonHeader(h: HeaderDrawContext) {
  const region = { x: 0, y: 932, w: h.width, h: 148 }
  const [ar, ag, ab] = h.accent
  const { ctx, doc, customLogo, gameLogo } = h
  const locale = doc.posterLocale ?? 'zh'
  const titleFont = fontFamily(doc.titleFontId)
  const rankFont = fontFamily(doc.rankFontId, 'bebas')

  ctx.fillStyle = '#f4f4f6'
  ctx.fillRect(region.x, region.y, region.w, region.h)
  ctx.fillStyle = `rgb(${ar},${ag},${ab})`
  ctx.fillRect(region.x, region.y, region.w, 3)

  const leftX = 36
  const metaX = 560
  const gapAfterTag = 14
  const tagPadX = 10
  const top8Label = 'TOP 8'
  const top8Size = 84

  ctx.font = `800 ${top8Size}px ${rankFont}`
  const top8W = ctx.measureText(top8Label).width
  const top8MaxRight = metaX - 24

  const series = (doc.tournamentName || 'TOP 8').toUpperCase()
  ctx.fillStyle = '#1a1f2e'
  ctx.font = `700 13px ${titleFont}`
  ctx.textBaseline = 'top'
  ctx.letterSpacing = '1.2px'
  const seriesMaxW = Math.max(120, top8MaxRight - leftX)
  const seriesSize = fitText(ctx, series, seriesMaxW, 13, '700', titleFont)
  ctx.font = `700 ${seriesSize}px ${titleFont}`
  ctx.fillText(series, leftX, region.y + 26)
  ctx.letterSpacing = '0px'

  let top8X = leftX + 188
  if (doc.subtitle) {
    const tagY = region.y + 48
    const tagMaxRight = top8MaxRight - top8W - gapAfterTag
    const tagMaxInner = Math.max(32, tagMaxRight - leftX - tagPadX * 2)
    let tag = doc.subtitle.toUpperCase()
    let tagSize = fitText(ctx, tag, tagMaxInner, 11, '700', titleFont)
    ctx.font = `700 ${tagSize}px ${titleFont}`
    while (tag.length > 1 && ctx.measureText(tag).width > tagMaxInner) {
      tag = tag.slice(0, -1)
    }
    if (ctx.measureText(tag).width > tagMaxInner && tag.length > 1) {
      while (tag.length > 1 && ctx.measureText(`${tag}…`).width > tagMaxInner) {
        tag = tag.slice(0, -1)
      }
      tag = `${tag}…`
    }
    const tagW = ctx.measureText(tag).width + tagPadX * 2
    ctx.fillStyle = `rgb(${ar},${ag},${ab})`
    ctx.fillRect(leftX, tagY, tagW, 22)
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.fillText(tag, leftX + tagPadX, tagY + 11)
    ctx.textBaseline = 'top'
    top8X = Math.min(leftX + tagW + gapAfterTag, top8MaxRight - top8W)
  }

  ctx.fillStyle = '#12151f'
  ctx.font = `800 ${top8Size}px ${rankFont}`
  ctx.textBaseline = 'middle'
  ctx.fillText(top8Label, top8X, region.y + 76)

  ctx.fillStyle = '#9aa3b5'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(metaX + i * 14, region.y + 48, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  if (doc.date) {
    ctx.fillStyle = '#1a1f2e'
    ctx.font = `700 22px ${titleFont}`
    ctx.textBaseline = 'top'
    ctx.fillText(doc.date, metaX, region.y + 60)
  }

  const entrants = formatEntrants(doc.numEntrants, locale)
  if (entrants) {
    ctx.fillStyle = '#5c6578'
    ctx.font = `600 14px ${titleFont}`
    const entrantsLabel = locale === 'en' ? entrants.toUpperCase() : entrants
    ctx.fillText(entrantsLabel, metaX, region.y + 92)
  }

  const rightX = region.w - 36
  ctx.textAlign = 'right'
  if (gameLogo) {
    const { w, h: lgH } = fitImageSize(gameLogo, 220, 68)
    ctx.drawImage(gameLogo, rightX - w, region.y + 40, w, lgH)
  }
  if (customLogo) {
    const { w, h: lgH } = fitImageSize(customLogo, 72, 72)
    const logoX = gameLogo ? rightX - 260 : rightX - w
    ctx.drawImage(customLogo, logoX, region.y + 38, w, lgH)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawEbifcHeader(h: HeaderDrawContext) {
  const region = { x: 36, y: 20, w: h.width - 72, h: 148 }
  const { ctx, doc, customLogo, gameLogo } = h
  const locale = doc.posterLocale ?? 'zh'
  const titleFont = fontFamily(doc.titleFontId)
  const rankFont = fontFamily(doc.rankFontId, 'press-start')
  const orange = '#ff8a3d'
  const blue = '#1a9fff'

  // 贴纸投影
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(region.x + 6, region.y + 6, region.w, region.h)

  // 贴纸本体
  ctx.fillStyle = '#121a2a'
  ctx.fillRect(region.x, region.y, region.w, region.h)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 6
  ctx.strokeRect(region.x + 3, region.y + 3, region.w - 6, region.h - 6)

  // 左侧 TOP 8 像素块
  const badgeW = 176
  const badgeH = 104
  const badgeX = region.x + 18
  const badgeY = region.y + (region.h - badgeH) / 2
  ctx.fillStyle = blue
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH)
  ctx.fillStyle = '#0a1220'
  ctx.fillRect(badgeX + 4, badgeY + 4, badgeW - 8, badgeH - 8)
  ctx.fillStyle = blue
  ctx.font = `700 28px ${rankFont}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText('TOP 8', badgeX + badgeW / 2, badgeY + badgeH / 2)
  ctx.textAlign = 'left'

  // 右侧 Logo：自定义在左，游戏 Logo 在右（仅用户上传/设置时显示自定义）
  let rightX = region.x + region.w - 20
  if (gameLogo) {
    const { w, h: lgH } = fitImageSize(gameLogo, 280, 96)
    ctx.drawImage(gameLogo, rightX - w, region.y + (region.h - lgH) / 2, w, lgH)
    rightX -= w + 16
  }
  if (customLogo) {
    const { w, h: lgH } = fitImageSize(customLogo, 108, 96)
    ctx.drawImage(customLogo, rightX - w, region.y + (region.h - lgH) / 2, w, lgH)
    rightX -= w + 20
  }

  // 标题 / 副标题 / 元信息（分三行，避免重叠）
  const textX = badgeX + badgeW + 24
  const textMaxW = Math.max(200, rightX - textX - 12)
  const title = doc.tournamentName || 'EbifightClub'
  const titleSize = fitText(ctx, title, textMaxW, 42, '800', titleFont)
  ctx.fillStyle = orange
  ctx.font = `800 ${titleSize}px ${titleFont}`
  ctx.textBaseline = 'top'
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.lineWidth = 4
  const titleY = region.y + 22
  ctx.strokeText(title, textX, titleY)
  ctx.fillText(title, textX, titleY)

  const sub = (doc.subtitle || '').trim()
  const meta = [doc.date, formatEntrants(doc.numEntrants, locale)].filter(Boolean).join('  ·  ')
  const subY = titleY + titleSize + 10
  if (sub) {
    const subSize = fitText(ctx, sub, textMaxW, 20, '700', titleFont)
    ctx.fillStyle = blue
    ctx.font = `700 ${subSize}px ${titleFont}`
    ctx.strokeText(sub, textX, subY)
    ctx.fillText(sub, textX, subY)
  }
  if (meta) {
    const metaY = sub ? subY + 28 : subY
    ctx.fillStyle = 'rgba(247,243,234,0.68)'
    const metaSize = fitText(ctx, meta, textMaxW, 15, '600', titleFont)
    ctx.font = `600 ${metaSize}px ${titleFont}`
    ctx.fillText(meta, textX, metaY)
  }

  ctx.textBaseline = 'alphabetic'
}

function drawAnimefgcHeader(h: HeaderDrawContext) {
  const region = { x: 0, y: 0, w: h.width, h: 100 }
  const { ctx, doc, customLogo, gameLogo } = h
  const locale = doc.posterLocale ?? 'zh'
  const titleFont = fontFamily(doc.titleFontId)
  const rankFont = fontFamily(doc.rankFontId, 'bebas')
  const [ar, ag, ab] = h.accent

  const topGrad = ctx.createLinearGradient(0, 0, 0, region.h)
  topGrad.addColorStop(0, 'rgba(0,0,0,0.82)')
  topGrad.addColorStop(0.65, 'rgba(0,0,0,0.45)')
  topGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(region.x, region.y, region.w, region.h)

  let logoX = 28
  if (customLogo) {
    const { w, h: lgH } = fitImageSize(customLogo, 72, 72)
    ctx.drawImage(customLogo, logoX, region.y + (region.h - lgH) / 2, w, lgH)
    logoX += w + 16
  }
  if (gameLogo) {
    const { w, h: lgH } = fitImageSize(gameLogo, 140, 56)
    ctx.drawImage(gameLogo, logoX, region.y + (region.h - lgH) / 2, w, lgH)
  }

  const title = doc.tournamentName || 'TOP 8'
  const meta = [doc.subtitle, formatEntrants(doc.numEntrants, locale), doc.date]
    .filter(Boolean)
    .join('  ·  ')

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#f7f3ea'
  const titleSize = fitText(ctx, title, region.w * 0.5, 34, '800', titleFont)
  ctx.font = `800 ${titleSize}px ${titleFont}`
  ctx.fillText(title, region.w / 2, region.y + 22)

  if (meta) {
    ctx.fillStyle = `rgb(${ar},${ag},${ab})`
    ctx.font = `600 15px ${titleFont}`
    ctx.fillText(meta, region.w / 2, region.y + 22 + titleSize + 6)
  }

  ctx.fillStyle = `rgb(${ar},${ag},${ab})`
  ctx.font = `italic 800 28px ${rankFont}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillText('TOP 8', region.w - 32, region.y + region.h / 2)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawHeaderFromLayout(
  h: HeaderDrawContext,
  headerTexts: HeaderLayoutTexts,
  headerRegion: import('../types').HeaderRegion,
) {
  const { ctx, doc, accent, customLogo, gameLogo } = h
  const titleFontId = doc.titleFontId
  const rankFontId = doc.rankFontId

  if (headerTexts.customLogo && customLogo) {
    drawLayoutImageBox(ctx, customLogo, offsetImageBox(headerRegion, headerTexts.customLogo))
  }
  if (headerTexts.gameLogo && gameLogo) {
    drawLayoutImageBox(ctx, gameLogo, offsetImageBox(headerRegion, headerTexts.gameLogo))
  }

  const textKeys: HeaderTextKey[] = [
    'tournamentName',
    'subtitle',
    'metaLine',
    'top8Label',
    'resultsLabel',
  ]
  for (const key of textKeys) {
    const box = headerTexts[key]
    if (!box || box.visible === false) continue
    const text = resolveTextBoxContent(box, { scope: 'header', doc, builtInKey: key })
    const fontId =
      key === 'top8Label' ? rankFontId : titleFontId
    const stroke = key === 'tournamentName' || key === 'top8Label'
    drawLayoutTextBox(ctx, text, offsetTextBox(headerRegion, box), fontId, accent, stroke)
  }
  if (headerTexts.extras) {
    for (const box of headerTexts.extras) {
      if (box.visible === false) continue
      const text = resolveTextBoxContent(box, { scope: 'header', doc })
      if (!text) continue
      drawLayoutTextBox(ctx, text, offsetTextBox(headerRegion, box), titleFontId, accent, false)
    }
  }
}

export function drawCreditsFromLayout(
  ctx: CanvasRenderingContext2D,
  doc: Top8Doc,
  box: import('../types').TextBoxLayout,
  isParagon: boolean,
) {
  const color =
    box.color ?? (isParagon ? 'rgba(26,31,46,0.45)' : 'rgba(247,243,234,0.45)')
  drawLayoutTextBox(ctx, resolveCreditsText(), { ...box, color }, doc.titleFontId)
}

export function drawHeader(
  ctx: CanvasRenderingContext2D,
  doc: Top8Doc,
  styleId: HeaderStyleId,
  width: number,
  accent: [number, number, number],
  images: Map<string, HTMLImageElement>,
  headerTexts?: HeaderLayoutTexts,
  headerRegion?: import('../types').HeaderRegion,
  headerTextMode: import('../types').LayoutTextRenderMode = 'custom',
) {
  const h: HeaderDrawContext = {
    ctx,
    doc,
    width,
    accent,
    customLogo: images.get('customLogo'),
    gameLogo: images.get('logo'),
  }
  if (
    headerTextMode === 'custom' &&
    headerTexts &&
    Object.keys(headerTexts).length > 0
  ) {
    drawHeaderFromLayout(
      h,
      headerTexts,
      headerRegion ?? defaultHeaderRegion(styleId, width),
    )
    return
  }
  switch (styleId) {
    case 'banner':
      drawBannerHeader(h)
      break
    case 'hero':
      drawHeroHeader(h)
      break
    case 'bottom':
      drawBottomHeader(h)
      break
    case 'tokon':
      drawTokonHeader(h)
      break
    case 'paragon':
      drawParagonHeader(h)
      break
    case 'animefgc':
      drawAnimefgcHeader(h)
      break
    case 'ebifc':
      drawEbifcHeader(h)
      break
    default:
      drawCompactHeader(h)
  }
}
