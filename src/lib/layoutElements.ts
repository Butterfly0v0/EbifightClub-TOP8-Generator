import type {
  HeaderLayoutTexts,
  HeaderRegion,
  HeaderStyleId,
  HeaderTextContentSource,
  ImageBoxLayout,
  LayoutSlot,
  LayoutTheme,
  PlayerSlot,
  SlotTextContentSource,
  SlotTextLayout,
  TextBoxLayout,
  TextContentMode,
  TextContentSource,
  Top8Doc,
} from '../types'
import { canvasFont } from './fonts'

export type HeaderTextKey = keyof Omit<HeaderLayoutTexts, 'customLogo' | 'gameLogo' | 'extras'>
export type HeaderImageKey = 'customLogo' | 'gameLogo'
export type SlotTextKey = keyof Omit<SlotTextLayout, 'extras'>

const DEFAULT_TEXT: TextBoxLayout = {
  x: 0,
  y: 0,
  w: 200,
  h: 32,
  fontSize: 24,
  align: 'left',
  fontWeight: '700',
  visible: true,
}

function tb(
  partial: Partial<TextBoxLayout> & Pick<TextBoxLayout, 'x' | 'y' | 'w' | 'h' | 'fontSize'>,
): TextBoxLayout {
  return { ...DEFAULT_TEXT, ...partial }
}

function img(
  partial: Partial<ImageBoxLayout> & Pick<ImageBoxLayout, 'x' | 'y' | 'w' | 'h'>,
): ImageBoxLayout {
  return { x: partial.x, y: partial.y, w: partial.w, h: partial.h, visible: partial.visible ?? true }
}

/** 将相对父框坐标转为画布绝对坐标 */
export function offsetTextBox(
  parent: { x: number; y: number },
  box: TextBoxLayout,
): TextBoxLayout {
  return { ...box, x: parent.x + box.x, y: parent.y + box.y }
}

export function offsetImageBox(
  parent: { x: number; y: number },
  box: ImageBoxLayout,
): ImageBoxLayout {
  return { ...box, x: parent.x + box.x, y: parent.y + box.y }
}

function toRelativeTextBox(
  parent: { x: number; y: number },
  box: TextBoxLayout,
): TextBoxLayout {
  return { ...box, x: box.x - parent.x, y: box.y - parent.y }
}

function toRelativeImageBox(
  parent: { x: number; y: number },
  box: ImageBoxLayout,
): ImageBoxLayout {
  return { ...box, x: box.x - parent.x, y: box.y - parent.y }
}

/** 坐标相对标题栏区域左上角 */
export function defaultHeaderTexts(
  header: HeaderRegion,
  styleId: HeaderStyleId,
  width = 1920,
): HeaderLayoutTexts {
  const rw = header.w
  const rh = header.h

  switch (styleId) {
    case 'banner':
      return {
        customLogo: img({ x: 40, y: 20, w: 280, h: rh - 40 }),
        gameLogo: img({ x: rw - 220 - 14, y: 20, w: 220, h: rh - 40 }),
        tournamentName: tb({
          x: 120,
          y: 28,
          w: rw * 0.55,
          h: 44,
          fontSize: 46,
          fontWeight: '800',
          color: '#f7f3ea',
        }),
        metaLine: tb({
          x: 120,
          y: 88,
          w: rw * 0.55,
          h: 30,
          fontSize: 26,
          fontWeight: '600',
        }),
      }
    case 'hero':
      return {
        customLogo: img({ x: 28, y: 24, w: 420, h: rh - 48 }),
        gameLogo: img({ x: rw - 400 - 12, y: 24, w: 400, h: rh - 48 }),
        tournamentName: tb({
          x: 80,
          y: 36,
          w: rw * 0.55,
          h: 48,
          fontSize: 52,
          fontWeight: '800',
          color: '#f7f3ea',
        }),
        metaLine: tb({
          x: 80,
          y: 118,
          w: rw * 0.55,
          h: 32,
          fontSize: 28,
          fontWeight: '600',
        }),
      }
    case 'bottom':
      return {
        customLogo: img({ x: 22, y: 14, w: 280, h: rh - 28 }),
        gameLogo: img({ x: rw - 220 - 14, y: 14, w: 220, h: rh - 28 }),
        tournamentName: tb({
          x: 70,
          y: 18,
          w: rw * 0.62,
          h: 36,
          fontSize: 38,
          fontWeight: '800',
          color: '#f7f3ea',
        }),
        metaLine: tb({
          x: 70,
          y: 58,
          w: rw * 0.62,
          h: 26,
          fontSize: 22,
          fontWeight: '600',
        }),
      }
    case 'tokon':
      return {
        customLogo: img({ x: 40, y: 24, w: 100, h: 100 }),
        gameLogo: img({ x: width - 40 - 280, y: 58, w: 280, h: 72 }),
        top8Label: tb({
          x: 156,
          y: 48,
          w: 200,
          h: 52,
          fontSize: 76,
          fontWeight: '800',
          color: '#f7f3ea',
        }),
        tournamentName: tb({
          x: 380,
          y: 28,
          w: Math.max(240, width - 380 - 340),
          h: 36,
          fontSize: 34,
          fontWeight: '800',
          color: '#f7f3ea',
        }),
        subtitle: tb({
          x: 380,
          y: 68,
          w: Math.max(240, width - 380 - 340),
          h: 28,
          fontSize: 26,
          fontWeight: '600',
          color: '#e8c547',
        }),
        metaLine: tb({
          x: 380,
          y: 104,
          w: Math.max(240, width - 380 - 340),
          h: 22,
          fontSize: 16,
          fontWeight: '500',
          color: 'rgba(247,243,234,0.72)',
        }),
        resultsLabel: tb({
          x: width - 280,
          y: 36,
          w: 240,
          h: 20,
          fontSize: 13,
          fontWeight: '700',
          align: 'right',
        }),
      }
    case 'paragon':
      return {
        customLogo: img({ x: width - 36 - 72, y: 38, w: 72, h: 72 }),
        gameLogo: img({ x: width - 36 - 220, y: 40, w: 220, h: 68 }),
        tournamentName: tb({
          x: 36,
          y: 26,
          w: 480,
          h: 18,
          fontSize: 13,
          fontWeight: '700',
          color: '#1a1f2e',
        }),
        subtitle: tb({
          x: 36,
          y: 48,
          w: 168,
          h: 22,
          fontSize: 11,
          fontWeight: '700',
          color: '#ffffff',
        }),
        top8Label: tb({
          x: 218,
          y: 44,
          w: 280,
          h: 64,
          fontSize: 84,
          fontWeight: '800',
          color: '#12151f',
        }),
        metaLine: tb({
          x: 560,
          y: 60,
          w: 320,
          h: 50,
          fontSize: 22,
          fontWeight: '700',
          color: '#1a1f2e',
        }),
      }
    case 'animefgc':
      return {
        customLogo: img({ x: 28, y: 14, w: 72, h: 72 }),
        gameLogo: img({ x: 116, y: 22, w: 140, h: 56 }),
        tournamentName: tb({
          x: width / 2 - 280,
          y: 22,
          w: 560,
          h: 36,
          fontSize: 34,
          fontWeight: '800',
          align: 'center',
          color: '#f7f3ea',
        }),
        metaLine: tb({
          x: width / 2 - 280,
          y: 58,
          w: 560,
          h: 22,
          fontSize: 15,
          fontWeight: '600',
          align: 'center',
        }),
        top8Label: tb({
          x: width - 140,
          y: 36,
          w: 108,
          h: 28,
          fontSize: 28,
          fontWeight: '800',
          align: 'right',
        }),
      }
    case 'ebifc':
      return {
        customLogo: img({ x: rw - 20 - 280 - 16 - 108, y: 26, w: 108, h: 96 }),
        gameLogo: img({ x: rw - 20 - 280, y: 26, w: 280, h: 96 }),
        top8Label: tb({
          x: 18,
          y: 22,
          w: 176,
          h: 104,
          fontSize: 28,
          fontWeight: '700',
          align: 'center',
          color: '#1a9fff',
        }),
        tournamentName: tb({
          x: 218,
          y: 22,
          w: Math.max(240, rw - 218 - 440),
          h: 46,
          fontSize: 40,
          fontWeight: '800',
          color: '#ff8a3d',
        }),
        subtitle: tb({
          x: 218,
          y: 74,
          w: Math.max(240, rw - 218 - 440),
          h: 26,
          fontSize: 20,
          fontWeight: '700',
          color: '#1a9fff',
        }),
        metaLine: tb({
          x: 218,
          y: 106,
          w: Math.max(240, rw - 218 - 440),
          h: 20,
          fontSize: 15,
          fontWeight: '600',
          color: 'rgba(247,243,234,0.68)',
        }),
      }
    case 'prism':
      return {
        customLogo: img({ x: rw - 20 - 160, y: 2, w: 160, h: 92 }),
        gameLogo: img({ x: rw - 20 - 160 - 16 - 420, y: 6, w: 420, h: 84 }),
        top8Label: tb({
          x: 68,
          y: 22,
          w: 140,
          h: 40,
          fontSize: 32,
          fontWeight: '700',
          color: '#f4f1ff',
        }),
        tournamentName: tb({
          x: 248,
          y: 16,
          w: Math.max(240, rw - 248 - 620),
          h: 32,
          fontSize: 28,
          fontWeight: '700',
          color: '#f4f1ff',
        }),
        metaLine: tb({
          x: 248,
          y: 52,
          w: Math.max(240, rw - 248 - 620),
          h: 20,
          fontSize: 13,
          fontWeight: '600',
          color: '#22d3ee',
        }),
      }
    default:
      return {
        customLogo: img({ x: 22, y: 14, w: 72, h: rh - 28 }),
        gameLogo: img({ x: rw - 220 - 14, y: 14, w: 220, h: rh - 28 }),
        tournamentName: tb({
          x: 70,
          y: 12,
          w: rw * 0.62,
          h: 36,
          fontSize: 40,
          fontWeight: '800',
          color: '#f7f3ea',
        }),
        metaLine: tb({
          x: 70,
          y: 54,
          w: rw * 0.62,
          h: 28,
          fontSize: 24,
          fontWeight: '600',
        }),
      }
  }
}

export function defaultCreditsText(
  width = 1920,
  height = 1080,
  headerStyleId: HeaderStyleId = 'compact',
): TextBoxLayout {
  const onLightBar = headerStyleId === 'paragon'
  return tb({
    x: 16,
    y: height - 22,
    w: Math.min(920, width - 32),
    h: 18,
    fontSize: 12,
    fontWeight: '500',
    color: onLightBar ? 'rgba(26,31,46,0.45)' : 'rgba(247,243,234,0.45)',
  })
}

export function defaultSlotTextLayout(
  slot: LayoutSlot,
  theme: LayoutTheme = 'default',
): SlotTextLayout {
  const paragon = theme === 'paragon'
  const animefgc = theme === 'animefgc'
  const tokon = theme === 'tokon'
  const ebifc = theme === 'ebifc'
  const prism = theme === 'prism'
  if (animefgc) {
    const isChamp = slot.playerIndex === 0
    if (isChamp) {
      return {
        rank: tb({
          x: 24,
          y: slot.h - 82,
          w: 140,
          h: 88,
          fontSize: 84,
          fontWeight: '800',
          color: '#f5c518',
        }),
        name: tb({
          x: 24,
          y: slot.h - 52,
          w: slot.w - 48,
          h: 40,
          fontSize: 42,
          fontWeight: '800',
          align: 'center',
          color: '#fffefb',
        }),
      }
    }
    const textPad = 16
    return {
      rank: tb({
        x: textPad,
        y: slot.h / 2 - 14,
        w: 100,
        h: 28,
        fontSize: 28,
        fontWeight: '800',
        align: 'left',
      }),
      name: tb({
        x: slot.w - textPad - 180,
        y: slot.h / 2 - 22,
        w: 180,
        h: 26,
        fontSize: 26,
        fontWeight: '800',
        align: 'right',
        color: '#f7f3ea',
      }),
      twitter: tb({
        x: slot.w - textPad - 180,
        y: slot.h / 2 + 4,
        w: 180,
        h: 18,
        fontSize: 15,
        fontWeight: '500',
        align: 'right',
        color: 'rgba(247,243,234,0.88)',
      }),
    }
  }
  if (ebifc) {
    const plateH = slot.playerIndex === 0 ? 56 : 44
    return {
      rank: tb({
        x: slot.w - 12 - 70,
        y: slot.h - plateH + 8,
        w: 70,
        h: plateH - 16,
        fontSize: 16,
        fontWeight: '700',
        align: 'right',
        color: '#ffffff',
      }),
      name: tb({
        x: 12,
        y: slot.h - plateH + 8,
        w: slot.w - 90,
        h: plateH - 16,
        fontSize: slot.nameSize,
        fontWeight: '800',
        color: '#ffffff',
      }),
      twitter: tb({
        x: 12,
        y: slot.h - 20,
        w: slot.w - 24,
        h: 16,
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(247,243,234,0.85)',
      }),
    }
  }
  if (prism) {
    const plateH = slot.playerIndex === 0 ? 56 : slot.h < 280 ? 34 : 42
    const cut = slot.playerIndex === 0 ? 22 : 16
    return {
      rank: tb({
        x: 18,
        y: 12,
        w: 160,
        h: slot.placeSize + 8,
        fontSize: slot.placeSize,
        fontWeight: '700',
        color: '#a78bfa',
      }),
      name: tb({
        x: cut + 10,
        y: slot.h - plateH + 8,
        w: slot.w - cut - 24,
        h: plateH - 14,
        fontSize: slot.nameSize,
        fontWeight: '800',
        color: '#f4f1ff',
      }),
      twitter: tb({
        x: cut + 10,
        y: slot.h - 18,
        w: slot.w - cut - 24,
        h: 14,
        fontSize: 12,
        fontWeight: '500',
        color: '#22d3ee',
      }),
    }
  }
  return {
    rank: tb({
      x: paragon ? 14 : tokon ? 12 : 16,
      y: paragon ? 10 : tokon ? 8 : 10,
      w: 120,
      h: slot.placeSize + 14,
      fontSize: slot.placeSize,
      fontWeight: '800',
      color: paragon ? '#ffffff' : undefined,
    }),
    name: tb({
      x: 16,
      y: slot.h - 36,
      w: slot.w - 32,
      h: 32,
      fontSize: slot.nameSize,
      fontWeight: '800',
      color: '#f7f3ea',
    }),
    twitter: tb({
      x: 16,
      y: slot.h - 64,
      w: slot.w - 32,
      h: 22,
      fontSize: 14,
      fontWeight: '500',
      color: 'rgba(247,243,234,0.78)',
    }),
    roster: tb({
      x: 16,
      y: slot.h - 88,
      w: slot.w - 32,
      h: 20,
      fontSize: 13,
      fontWeight: '500',
      color: 'rgba(247,243,234,0.65)',
    }),
  }
}

function migrateHeaderTextsToRelative(
  header: HeaderRegion,
  texts: HeaderLayoutTexts,
): HeaderLayoutTexts {
  const probe = texts.tournamentName ?? texts.metaLine ?? texts.top8Label
  if (!probe || probe.x < header.x - 2) return texts
  const out: HeaderLayoutTexts = { ...texts }
  const textKeys: HeaderTextKey[] = [
    'tournamentName',
    'subtitle',
    'metaLine',
    'top8Label',
    'resultsLabel',
  ]
  for (const k of textKeys) {
    const box = out[k]
    if (box) out[k] = toRelativeTextBox(header, box)
  }
  if (out.customLogo) out.customLogo = toRelativeImageBox(header, out.customLogo)
  if (out.gameLogo) out.gameLogo = toRelativeImageBox(header, out.gameLogo)
  if (out.extras) {
    out.extras = out.extras.map((box) => toRelativeTextBox(header, box))
  }
  return out
}

function migrateSlotTextToRelative(slot: LayoutSlot, tl: SlotTextLayout): SlotTextLayout {
  const probe = tl.rank ?? tl.name
  if (!probe || probe.x < slot.x - 2) return tl
  const out: SlotTextLayout = {}
  const keys: SlotTextKey[] = ['rank', 'name', 'twitter', 'roster']
  for (const k of keys) {
    const box = tl[k]
    if (box) out[k] = toRelativeTextBox(slot, box)
  }
  if (tl.extras) {
    out.extras = tl.extras.map((box) => toRelativeTextBox(slot, box))
  }
  return out
}

export function normalizeTextBox(raw: Partial<TextBoxLayout> | undefined): TextBoxLayout | undefined {
  if (!raw) return undefined
  const contentMode: TextContentMode = raw.contentMode === 'fixed' ? 'fixed' : 'auto'
  return {
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    w: Math.max(8, Number(raw.w) || 40),
    h: Math.max(8, Number(raw.h) || 20),
    fontSize: Math.max(8, Number(raw.fontSize) || 16),
    fontId: raw.fontId,
    color: raw.color,
    align: raw.align === 'center' || raw.align === 'right' ? raw.align : 'left',
    fontWeight: raw.fontWeight ?? '700',
    visible: raw.visible !== false,
    id: typeof raw.id === 'string' ? raw.id : undefined,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    contentMode,
    contentSource:
      typeof raw.contentSource === 'string' ? (raw.contentSource as TextContentSource) : undefined,
    fixedText: typeof raw.fixedText === 'string' ? raw.fixedText : undefined,
  }
}

function normalizeTextBoxList(raw: unknown): TextBoxLayout[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map((item) => normalizeTextBox(item as Partial<TextBoxLayout>))
    .filter((b): b is TextBoxLayout => Boolean(b))
}

export function newCustomTextBox(
  partial?: Partial<TextBoxLayout> & Pick<TextBoxLayout, 'x' | 'y' | 'w' | 'h' | 'fontSize'>,
): TextBoxLayout {
  return normalizeTextBox({
    ...DEFAULT_TEXT,
    id: crypto.randomUUID(),
    label: '自定义文字',
    contentMode: 'auto',
    contentSource: 'tag',
    x: 16,
    y: 16,
    w: 160,
    h: 28,
    fontSize: 18,
    ...partial,
  })!
}

export function normalizeImageBox(raw: Partial<ImageBoxLayout> | undefined): ImageBoxLayout | undefined {
  if (!raw) return undefined
  return {
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    w: Math.max(8, Number(raw.w) || 40),
    h: Math.max(8, Number(raw.h) || 40),
    visible: raw.visible !== false,
  }
}

export function normalizeHeaderTexts(raw: Partial<HeaderLayoutTexts> | undefined): HeaderLayoutTexts | undefined {
  if (!raw) return undefined
  const out: HeaderLayoutTexts = {}
  const keys: HeaderTextKey[] = [
    'tournamentName',
    'subtitle',
    'metaLine',
    'top8Label',
    'resultsLabel',
  ]
  for (const k of keys) {
    const v = normalizeTextBox(raw[k])
    if (v) out[k] = v
  }
  const customLogo = normalizeImageBox(raw.customLogo)
  const gameLogo = normalizeImageBox(raw.gameLogo)
  if (customLogo) out.customLogo = customLogo
  if (gameLogo) out.gameLogo = gameLogo
  const extras = normalizeTextBoxList(raw.extras)
  if (extras?.length) out.extras = extras
  return Object.keys(out).length > 0 ? out : undefined
}

export function normalizeSlotTextLayout(raw: Partial<SlotTextLayout> | undefined): SlotTextLayout | undefined {
  if (!raw) return undefined
  const out: SlotTextLayout = {}
  const keys: SlotTextKey[] = ['rank', 'name', 'twitter', 'roster']
  for (const k of keys) {
    const v = normalizeTextBox(raw[k])
    if (v) out[k] = v
  }
  const extras = normalizeTextBoxList(raw.extras)
  if (extras?.length) out.extras = extras
  return Object.keys(out).length > 0 ? out : undefined
}

function formatEntrants(
  raw: string | undefined,
  locale: Top8Doc['posterLocale'],
  teamMode = false,
): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return t
  const count = Math.round(n)
  if (locale === 'en') return `${count} ${teamMode ? 'teams' : 'participants'}`
  return `${count} ${teamMode ? '队伍' : '参赛者'}`
}

export function resolveHeaderTextContent(
  key: HeaderTextKey,
  doc: Top8Doc,
): string {
  const locale = doc.posterLocale ?? 'zh'
  switch (key) {
    case 'tournamentName':
      return doc.tournamentName || 'EbifightClub TOP 8'
    case 'subtitle':
      return doc.subtitle || 'Weekly TOP 8'
    case 'metaLine':
      return (
        [doc.subtitle, formatEntrants(doc.numEntrants, locale, doc.teamMode), doc.date]
          .filter(Boolean)
          .join('  ·  ') || 'TOP 8'
      )
    case 'top8Label':
      return 'TOP 8'
    case 'resultsLabel':
      return locale === 'en' ? 'TOURNAMENT RESULTS' : '赛事结果'
    default:
      return ''
  }
}

export function resolveCreditsText(): string {
  return 'Character assets from StreamHelperAssets  ·  EbifightClub TOP8 Generator'
}

export function resolveSlotPreviewText(
  key: SlotTextKey,
  place: number,
): string {
  switch (key) {
    case 'rank':
      return place === 1 ? '1ST' : place === 2 ? '2ND' : place === 3 ? '3RD' : `${place}TH`
    case 'name':
      return 'TEAM | Player'
    case 'twitter':
      return '@player'
    case 'roster':
      return 'Ryu · Ken'
    default:
      return ''
  }
}

export function resolveSlotTextContent(
  key: SlotTextKey,
  player: PlayerSlot,
  charNames: Map<string, string>,
  showRoster: boolean,
): string {
  switch (key) {
    case 'rank':
      const p = player.placement
      return p === 1 ? '1ST' : p === 2 ? '2ND' : p === 3 ? '3RD' : `${p}TH`
    case 'name':
      if (player.prefix && player.tag) return `${player.prefix} | ${player.tag}`
      return player.tag || 'TBD'
    case 'twitter':
      const raw = player.twitter.trim()
      if (!raw) return ''
      return raw.startsWith('@') ? raw : `@${raw}`
    case 'roster':
      if (!showRoster) return ''
      return player.characters
        .filter((c) => c?.codename || c?.customImageDataUrl)
        .map((c) =>
          c.codename
            ? (charNames.get(c.codename) ??
                c.codename.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()))
            : 'Custom',
        )
        .join(' · ')
    default:
      return ''
  }
}

function fitTextInBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: string,
  fontId: string,
): number {
  let s = size
  ctx.font = canvasFont(s, fontId, weight)
  while (s > 8 && ctx.measureText(text).width > maxWidth) {
    s -= 1
    ctx.font = canvasFont(s, fontId, weight)
  }
  return s
}

export function drawLayoutTextBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  box: TextBoxLayout,
  defaultFontId: string,
  accentRgb?: [number, number, number],
  strokeOutline = false,
) {
  if (!text || box.visible === false) return
  const fontId = box.fontId ?? defaultFontId
  const weight = box.fontWeight ?? '700'
  let color = box.color
  if (!color && accentRgb) {
    color = `rgb(${accentRgb[0]},${accentRgb[1]},${accentRgb[2]})`
  }
  if (!color) color = '#f7f3ea'

  const align = box.align ?? 'left'
  const fitted = fitTextInBox(ctx, text, box.w - 4, box.fontSize, weight, fontId)
  ctx.font = canvasFont(fitted, fontId, weight)
  ctx.fillStyle = color
  ctx.textBaseline = 'top'

  let x = box.x
  if (align === 'center') {
    ctx.textAlign = 'center'
    x = box.x + box.w / 2
  } else if (align === 'right') {
    ctx.textAlign = 'right'
    x = box.x + box.w
  } else {
    ctx.textAlign = 'left'
  }

  const y = box.y + Math.max(0, (box.h - fitted) / 2)
  if (strokeOutline) {
    ctx.lineWidth = Math.max(3, fitted * 0.12)
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.strokeText(text, x, y)
  }
  ctx.fillText(text, x, y)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

export function drawLayoutImageBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: ImageBoxLayout,
) {
  if (box.visible === false || img.width <= 0) return
  const ratio = img.width / img.height
  let w = box.w
  let h = w / ratio
  if (h > box.h) {
    h = box.h
    w = h * ratio
  }
  const x = box.x + (box.w - w) / 2
  const y = box.y + (box.h - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

export const HEADER_TEXT_LABELS: Record<HeaderTextKey, string> = {
  tournamentName: '赛事名称',
  subtitle: '副标题',
  metaLine: '元信息行',
  top8Label: 'TOP 8 标签',
  resultsLabel: '赛事结果标签',
}

export const HEADER_IMAGE_LABELS: Record<HeaderImageKey, string> = {
  customLogo: '自定义 Logo',
  gameLogo: '游戏 Logo',
}

export const SLOT_TEXT_LABELS: Record<SlotTextKey, string> = {
  rank: '名次标签',
  name: '选手名',
  twitter: '社交账号',
  roster: '角色列表',
}

export const SLOT_CONTENT_SOURCE_OPTIONS: Array<{ id: SlotTextContentSource; label: string }> = [
  { id: 'rank', label: '名次' },
  { id: 'name', label: '选手名（含战队前缀）' },
  { id: 'tag', label: '选手 ID' },
  { id: 'prefix', label: '战队/前缀' },
  { id: 'twitter', label: '社交账号' },
  { id: 'roster', label: '角色列表' },
]

export const HEADER_CONTENT_SOURCE_OPTIONS: Array<{ id: HeaderTextContentSource; label: string }> = [
  { id: 'tournamentName', label: '赛事名称' },
  { id: 'subtitle', label: '副标题' },
  { id: 'metaLine', label: '元信息行' },
  { id: 'top8Label', label: 'TOP 8 标签' },
  { id: 'resultsLabel', label: '赛事结果标签' },
  { id: 'date', label: '日期' },
  { id: 'numEntrants', label: '参赛人数' },
]

export function resolveTextBoxContent(
  box: TextBoxLayout,
  ctx: {
    scope: 'header' | 'slot'
    doc: Top8Doc
    player?: PlayerSlot
    charNames?: Map<string, string>
    showRoster?: boolean
    builtInKey?: HeaderTextKey | SlotTextKey
  },
): string {
  if (box.contentMode === 'fixed') return box.fixedText ?? ''
  const source = (box.contentSource ?? ctx.builtInKey) as TextContentSource | undefined
  if (!source) return ''
  if (ctx.scope === 'header') {
    if (source === 'date') return ctx.doc.date || ''
    if (source === 'numEntrants') {
      return formatEntrants(ctx.doc.numEntrants, ctx.doc.posterLocale ?? 'zh', ctx.doc.teamMode)
    }
    if (
      source === 'tournamentName' ||
      source === 'subtitle' ||
      source === 'metaLine' ||
      source === 'top8Label' ||
      source === 'resultsLabel'
    ) {
      return resolveHeaderTextContent(source, ctx.doc)
    }
    return ''
  }
  if (!ctx.player) return ''
  if (source === 'prefix') return ctx.player.prefix
  if (source === 'tag') return ctx.player.tag || 'TBD'
  if (source === 'rank' || source === 'name' || source === 'twitter' || source === 'roster') {
    return resolveSlotTextContent(
      source,
      ctx.player,
      ctx.charNames ?? new Map(),
      ctx.showRoster !== false,
    )
  }
  return ''
}

export function resolveTextBoxPreview(
  box: TextBoxLayout,
  ctx: {
    scope: 'header' | 'slot'
    builtInKey?: HeaderTextKey | SlotTextKey
    place?: number
  },
): string {
  if (box.contentMode === 'fixed') return box.fixedText ?? '固定文字'
  const source = (box.contentSource ?? ctx.builtInKey) as TextContentSource | undefined
  if (!source) return '文字'
  if (ctx.scope === 'header') {
    if (source === 'date') return '2026-03-15'
    if (source === 'numEntrants') return '256 参赛者'
    if (source === 'tournamentName') return 'EbifightClub #128'
    if (source === 'subtitle') return 'Road to EVO'
    if (source === 'metaLine') return 'Road to EVO · 256 参赛者 · 2026-03-15'
    if (source === 'top8Label') return 'TOP 8'
    if (source === 'resultsLabel') return '赛事结果'
    return '文字'
  }
  const place = ctx.place ?? 1
  if (source === 'prefix') return 'TEAM Alpha'
  if (source === 'tag') return 'PlayerOne'
  if (source === 'rank' || source === 'name' || source === 'twitter' || source === 'roster') {
    return resolveSlotPreviewText(source, place)
  }
  return '文字'
}

export function textBoxEditorLabel(
  box: TextBoxLayout,
  fallback: string,
): string {
  return box.label?.trim() || fallback
}

/** 为布局补全默认文字/Logo 元素（旧布局导入时） */
export function ensureLayoutTexts(layout: import('../types').CustomLayoutDef): import('../types').CustomLayoutDef {
  const style = layout.headerStyleId ?? layout.recommendedHeaderStyleId ?? 'compact'
  const theme = layout.theme ?? 'default'
  let headerTexts =
    layout.headerTexts ?? defaultHeaderTexts(layout.header, style, layout.width)
  let slots = layout.slots.map((s) => ({
    ...s,
    textLayout: s.textLayout ?? defaultSlotTextLayout(s, theme),
  }))
  if (!layout.textCoordsRelative) {
    headerTexts = migrateHeaderTextsToRelative(layout.header, headerTexts)
    slots = slots.map((s) => ({
      ...s,
      textLayout: migrateSlotTextToRelative(s, s.textLayout!),
    }))
  }
  return {
    ...layout,
    backgroundImageDataUrl:
      layout.backgroundImageDataUrl ??
      layout.previewBackgroundDataUrl ??
      undefined,
    customLogoDataUrl: layout.customLogoDataUrl ?? '',
    background: layout.background ?? '#0a0b10',
    backgroundDim: layout.backgroundDim ?? 0.45,
    headerTexts,
    creditsText:
      layout.creditsText ?? defaultCreditsText(layout.width, layout.height, style),
    slots,
    textCoordsRelative: true,
  }
}
