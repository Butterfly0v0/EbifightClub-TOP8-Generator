import type { BoxStyle, BoxThemeId, Top8Doc } from '../types'
import { rankColor } from './rank'

export const BOX_THEME_LIST: Array<{ id: BoxThemeId; name: string; description: string }> = [
  { id: 'rank', name: '名次配色', description: '1st 金 / 2nd 银 / 3rd 铜，其余用强调色' },
  { id: 'accent', name: '统一强调色', description: '所有框使用海报强调色' },
  { id: 'monochrome', name: '单色', description: '银灰简约边框' },
  { id: 'neon', name: '霓虹', description: '高饱和电竞风配色' },
  { id: 'minimal', name: '极简', description: '细线半透明边框' },
  { id: 'custom', name: '自定义颜色', description: '手动指定边框与底色' },
  { id: 'image', name: '自定义图片', description: '上传框体装饰图' },
]

export const DEFAULT_BOX_STYLE: BoxStyle = { theme: 'rank' }

export function normalizeBoxStyle(raw: Partial<BoxStyle> | undefined): BoxStyle {
  if (!raw) return { ...DEFAULT_BOX_STYLE }
  const theme = BOX_THEME_LIST.some((t) => t.id === raw.theme) ? raw.theme! : 'rank'
  return {
    theme,
    color: raw.color,
    borderColor: raw.borderColor,
    fillColor: raw.fillColor,
    fillOpacity: clamp01(raw.fillOpacity),
    borderWidth: raw.borderWidth,
    borderOpacity: clamp01(raw.borderOpacity),
    frameImageUrl: raw.frameImageUrl,
    extraTheme: raw.extraTheme,
    extraColor: raw.extraColor,
    extraBorderColor: raw.extraBorderColor,
    extraFillColor: raw.extraFillColor,
    extraFillOpacity: clamp01(raw.extraFillOpacity),
    extraBorderWidth: raw.extraBorderWidth,
    extraBorderOpacity: clamp01(raw.extraBorderOpacity),
    extraBorderRadius: raw.extraBorderRadius,
    extraFrameImageUrl: raw.extraFrameImageUrl,
  }
}

function clamp01(n: number | undefined): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined
  return Math.min(1, Math.max(0, n))
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function colorWithOpacity(color: string, opacity: number): string {
  if (color.startsWith('rgba')) return color
  if (color.startsWith('rgb(')) {
    const inner = color.slice(4, -1)
    return `rgba(${inner},${opacity})`
  }
  if (color.startsWith('#')) {
    const [r, g, b] = hexToRgb(color)
    return `rgba(${r},${g},${b},${opacity})`
  }
  return color
}

export function resolveBorderWidth(
  boxStyle: BoxStyle | undefined,
  place: number,
  kind: 'main' | 'extra',
): number {
  const style = normalizeBoxStyle(boxStyle)
  if (kind === 'extra' && style.extraBorderWidth != null) return style.extraBorderWidth
  if (style.borderWidth != null) return style.borderWidth
  return place === 1 ? 3 : 1.5
}

export function resolveBorderOpacity(boxStyle: BoxStyle | undefined, kind: 'main' | 'extra'): number {
  const style = normalizeBoxStyle(boxStyle)
  if (kind === 'extra' && style.extraBorderOpacity != null) return style.extraBorderOpacity
  if (style.borderOpacity != null) return style.borderOpacity
  return 1
}

export function resolveBoxAccent(
  place: number,
  doc: Top8Doc,
  boxStyle?: BoxStyle,
  kind: 'main' | 'extra' = 'main',
): string {
  const global = normalizeBoxStyle(doc.defaultBoxStyle)
  const style = normalizeBoxStyle(boxStyle ?? global)
  const theme = kind === 'extra' && style.extraTheme ? style.extraTheme : style.theme
  const customColor = kind === 'extra' ? style.extraColor : style.color
  const customBorder = kind === 'extra' ? style.extraBorderColor : style.borderColor

  switch (theme) {
    case 'rank':
      return customColor ?? rankColor(place, doc.accent)
    case 'accent':
      return customColor ?? doc.accent
    case 'monochrome':
      return customColor ?? '#c8ccd4'
    case 'neon':
      if (customColor) return customColor
      if (place === 1) return '#00f5ff'
      if (place === 2) return '#ff00aa'
      if (place === 3) return '#aaff00'
      return '#bf5fff'
    case 'minimal':
      return customBorder ?? customColor ?? 'rgba(255,255,255,0.4)'
    case 'custom':
      return customBorder ?? customColor ?? doc.accent
    case 'image':
      return customBorder ?? customColor ?? doc.accent
    default:
      return rankColor(place, doc.accent)
  }
}

export function resolveBoxFill(
  _place: number,
  doc: Top8Doc,
  boxStyle?: BoxStyle,
  opacity = 1,
): string {
  const style = normalizeBoxStyle(boxStyle ?? doc.defaultBoxStyle)
  const alpha = style.fillOpacity != null ? style.fillOpacity * opacity : opacity
  if (style.fillColor) {
    return colorWithOpacity(style.fillColor, alpha)
  }
  if (style.theme === 'minimal') {
    return `rgba(8,8,12,${Math.min(0.35, alpha * 0.35)})`
  }
  return `rgba(20,21,28,${alpha})`
}

export function resolveExtraBoxFill(
  _place: number,
  doc: Top8Doc,
  boxStyle?: BoxStyle,
  opacity = 1,
): string {
  const style = normalizeBoxStyle(boxStyle ?? doc.defaultBoxStyle)
  const fillAlpha = style.extraFillOpacity ?? 0.5
  const effectiveOpacity = fillAlpha * opacity
  const fillColor = style.extraFillColor ?? style.fillColor
  if (fillColor) {
    return colorWithOpacity(fillColor, effectiveOpacity)
  }
  const extraTheme = style.extraTheme ?? style.theme
  if (extraTheme === 'minimal') {
    return `rgba(8,8,12,${Math.min(0.35, effectiveOpacity * 0.35)})`
  }
  return `rgba(20,21,28,${effectiveOpacity})`
}

export function boxFrameKey(slotIndex: number, kind: 'main' | 'extra'): string {
  return `box:${slotIndex}:${kind}`
}

export function headerImageKey(): string {
  return 'header:bg'
}
