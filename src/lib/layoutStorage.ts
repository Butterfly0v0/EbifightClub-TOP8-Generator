import type {
  BoxStyle,
  CustomLayoutDef,
  ExtraCharLayoutConfig,
  HeaderRegion,
  LayoutSlot,
  PlayerIdLayoutConfig,
  TextBoxLayout,
} from '../types'
import { normalizeBoxStyle } from './boxThemes'
import { normalizeThemeConfig } from './themeConfig'
import { isValidFontId } from './fonts'
import { defaultHeaderRegion } from './headers'
import { MAX_EXTRA_CHARACTERS } from './extraCharLayout'
import {
  normalizeHeaderTexts,
  normalizeSlotTextLayout,
  normalizeTextBox,
} from './layoutElements'
import { saveApiUrl } from './projectPaths'

const LEGACY_LIBRARY_KEY = 'ebi-custom-layouts'
const LIBRARY_LS_PREFIX = 'ebi-custom-layouts:'

function libraryLocalKey(gameCode: string): string {
  return `${LIBRARY_LS_PREFIX}${gameCode}`
}

function normalizeHeader(raw: Partial<HeaderRegion> | undefined, styleId?: string): HeaderRegion {
  const fallback = defaultHeaderRegion(
    styleId === 'banner' ||
      styleId === 'hero' ||
      styleId === 'bottom' ||
      styleId === 'tokon' ||
      styleId === 'paragon' ||
      styleId === 'animefgc' ||
      styleId === 'ebifc' ||
      styleId === 'prism'
      ? styleId
      : 'compact',
  )
  if (!raw) return fallback
  return {
    ...fallback,
    x: Number(raw.x) || fallback.x,
    y: Number(raw.y) || fallback.y,
    w: Number(raw.w) || fallback.w,
    h: Number(raw.h) || fallback.h,
    backgroundOpacity:
      typeof raw.backgroundOpacity === 'number' ? raw.backgroundOpacity : fallback.backgroundOpacity,
    backgroundColor: raw.backgroundColor ?? fallback.backgroundColor,
    borderWidth: typeof raw.borderWidth === 'number' ? raw.borderWidth : fallback.borderWidth,
    borderColor: raw.borderColor,
    borderRadius: typeof raw.borderRadius === 'number' ? raw.borderRadius : fallback.borderRadius,
    accentBarHeight:
      typeof raw.accentBarHeight === 'number' ? raw.accentBarHeight : fallback.accentBarHeight,
  }
}

function normalizeSlot(raw: Partial<LayoutSlot>, fallbackIndex: number): LayoutSlot {
  return {
    playerIndex: typeof raw.playerIndex === 'number' ? raw.playerIndex : fallbackIndex,
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    w: Math.max(40, Number(raw.w) || 200),
    h: Math.max(40, Number(raw.h) || 200),
    focusX: typeof raw.focusX === 'number' ? raw.focusX : 0.5,
    focusY: typeof raw.focusY === 'number' ? raw.focusY : 0.32,
    nameSize: Number(raw.nameSize) || 28,
    placeSize: Number(raw.placeSize) || 48,
    radius: Number(raw.radius) || 12,
    boxStyle: raw.boxStyle ? normalizeBoxStyle(raw.boxStyle) : undefined,
    textLayout: normalizeSlotTextLayout(raw.textLayout as Partial<import('../types').SlotTextLayout>),
  }
}

function normalizeExtraCharLayout(raw: unknown): ExtraCharLayoutConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  return {
    mode: o.mode === 'sideStack' ? 'sideStack' : o.mode === 'bottomRow' ? 'bottomRow' : undefined,
    thumbSize: typeof o.thumbSize === 'number' ? o.thumbSize : undefined,
    gap: typeof o.gap === 'number' ? o.gap : undefined,
    paddingRight: typeof o.paddingRight === 'number' ? o.paddingRight : undefined,
    paddingBottom: typeof o.paddingBottom === 'number' ? o.paddingBottom : undefined,
  }
}

function normalizePlayerIdLayout(raw: unknown): PlayerIdLayoutConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: PlayerIdLayoutConfig = {}
  if (typeof o.plateHeight === 'number' && Number.isFinite(o.plateHeight)) out.plateHeight = o.plateHeight
  if (typeof o.hangGap === 'number' && Number.isFinite(o.hangGap)) out.hangGap = o.hangGap
  if (typeof o.paddingX === 'number' && Number.isFinite(o.paddingX)) out.paddingX = o.paddingX
  if (typeof o.paddingTop === 'number' && Number.isFinite(o.paddingTop)) out.paddingTop = o.paddingTop
  if (typeof o.veilStartRatio === 'number' && Number.isFinite(o.veilStartRatio)) {
    out.veilStartRatio = Math.min(1, Math.max(0, o.veilStartRatio))
  }
  if (typeof o.veilOpacity === 'number' && Number.isFinite(o.veilOpacity)) {
    out.veilOpacity = Math.min(1, Math.max(0, o.veilOpacity))
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function normalizeCustomLayout(raw: unknown): CustomLayoutDef | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const slotsRaw = Array.isArray(o.slots) ? o.slots : []
  if (slotsRaw.length === 0) return null
  const headerRaw = o.header as Partial<HeaderRegion> | undefined
  const styleHint =
    typeof o.headerStyleId === 'string'
      ? o.headerStyleId
      : typeof o.recommendedHeaderStyleId === 'string'
        ? o.recommendedHeaderStyleId
        : undefined
  return {
    id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
    name: typeof o.name === 'string' && o.name ? o.name : '导入的布局',
    description: typeof o.description === 'string' ? o.description : '',
    width: Number(o.width) || 1920,
    height: Number(o.height) || 1080,
    header: normalizeHeader(headerRaw, styleHint),
    slots: slotsRaw.map((s, i) => normalizeSlot(s as Partial<LayoutSlot>, i)),
    theme:
      o.theme === 'tokon'
        ? 'tokon'
        : o.theme === 'paragon'
          ? 'paragon'
          : o.theme === 'animefgc'
            ? 'animefgc'
            : o.theme === 'ebifc'
              ? 'ebifc'
              : o.theme === 'prism'
                ? 'prism'
                : undefined,
    recommendedHeaderStyleId:
      o.recommendedHeaderStyleId === 'banner' ||
      o.recommendedHeaderStyleId === 'hero' ||
      o.recommendedHeaderStyleId === 'bottom' ||
      o.recommendedHeaderStyleId === 'tokon' ||
      o.recommendedHeaderStyleId === 'paragon' ||
      o.recommendedHeaderStyleId === 'animefgc' ||
      o.recommendedHeaderStyleId === 'ebifc' ||
      o.recommendedHeaderStyleId === 'prism'
        ? o.recommendedHeaderStyleId
        : undefined,
    recommendedExtraCharStyleId:
      o.recommendedExtraCharStyleId === 'sideStack' ||
      o.recommendedExtraCharStyleId === 'custom' ||
      o.recommendedExtraCharStyleId === 'bottomRow'
        ? o.recommendedExtraCharStyleId
        : undefined,
    recommendedExtraCharLayout: normalizeExtraCharLayout(o.recommendedExtraCharLayout),
    recommendedPlayerIdStyleId:
      o.recommendedPlayerIdStyleId === 'inCard' ||
      o.recommendedPlayerIdStyleId === 'hang' ||
      o.recommendedPlayerIdStyleId === 'custom' ||
      o.recommendedPlayerIdStyleId === 'overlay'
        ? o.recommendedPlayerIdStyleId
        : undefined,
    recommendedPlayerIdLayout: normalizePlayerIdLayout(o.recommendedPlayerIdLayout),
    recommendedThemeConfig: normalizeThemeConfig(
      o.recommendedThemeConfig as Partial<import('../types').LayoutThemeConfig>,
    ),
    headerStyleId:
      o.headerStyleId === 'banner' ||
      o.headerStyleId === 'hero' ||
      o.headerStyleId === 'bottom' ||
      o.headerStyleId === 'tokon' ||
      o.headerStyleId === 'paragon' ||
      o.headerStyleId === 'animefgc' ||
      o.headerStyleId === 'ebifc' ||
      o.headerStyleId === 'prism' ||
      o.headerStyleId === 'compact'
        ? o.headerStyleId
        : undefined,
    headerImageUrl: typeof o.headerImageUrl === 'string' ? o.headerImageUrl : undefined,
    titleFontId:
      typeof o.titleFontId === 'string' && isValidFontId(o.titleFontId) ? o.titleFontId : undefined,
    playerFontId:
      typeof o.playerFontId === 'string' && isValidFontId(o.playerFontId) ? o.playerFontId : undefined,
    rankFontId:
      typeof o.rankFontId === 'string' && isValidFontId(o.rankFontId) ? o.rankFontId : undefined,
    defaultBoxStyle: o.defaultBoxStyle
      ? normalizeBoxStyle(o.defaultBoxStyle as Partial<BoxStyle>)
      : undefined,
    recommendedAccent:
      typeof o.recommendedAccent === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.recommendedAccent)
        ? o.recommendedAccent
        : undefined,
    backgroundImageDataUrl:
      typeof o.backgroundImageDataUrl === 'string'
        ? o.backgroundImageDataUrl
        : typeof o.previewBackgroundDataUrl === 'string'
          ? o.previewBackgroundDataUrl
          : undefined,
    background: typeof o.background === 'string' ? o.background : undefined,
    backgroundDim: typeof o.backgroundDim === 'number' ? o.backgroundDim : undefined,
    customLogoDataUrl:
      typeof o.customLogoDataUrl === 'string' &&
      o.customLogoDataUrl !== '/brand/custom-logo.png' &&
      o.customLogoDataUrl !== '/brand/ebifc-logo.png'
        ? o.customLogoDataUrl
        : undefined,
    previewBackgroundDataUrl:
      typeof o.previewBackgroundDataUrl === 'string' ? o.previewBackgroundDataUrl : undefined,
    headerTexts: normalizeHeaderTexts(o.headerTexts as Partial<import('../types').HeaderLayoutTexts>),
    headerTextMode: o.headerTextMode === 'theme' ? 'theme' : o.headerTextMode === 'custom' ? 'custom' : undefined,
    slotTextMode: o.slotTextMode === 'theme' ? 'theme' : o.slotTextMode === 'custom' ? 'custom' : undefined,
    creditsText: normalizeTextBox(o.creditsText as Partial<TextBoxLayout>),
    textCoordsRelative: o.textCoordsRelative === true ? true : undefined,
    previewExtraCount:
      typeof o.previewExtraCount === 'number'
        ? Math.min(MAX_EXTRA_CHARACTERS, Math.max(0, o.previewExtraCount))
        : 2,
    basedOn:
      o.basedOn === 'classic' ||
      o.basedOn === 'podium' ||
      o.basedOn === 'squares' ||
      o.basedOn === 'tokon' ||
      o.basedOn === 'paragon' ||
      o.basedOn === 'animefgc' ||
      o.basedOn === 'ebifc' ||
      o.basedOn === 'prism'
        ? o.basedOn
        : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function loadLayoutLibrary(gameCode: string): Promise<CustomLayoutDef[]> {
  try {
    const res = await fetch(saveApiUrl(gameCode, 'layouts'))
    if (res.ok) {
      const parsed = (await res.json()) as unknown[]
      if (Array.isArray(parsed)) {
        const list = parsed
          .map((item) => normalizeCustomLayout(item))
          .filter((l): l is CustomLayoutDef => Boolean(l))
        localStorage.setItem(libraryLocalKey(gameCode), JSON.stringify(list))
        return list
      }
    }
  } catch {
    /* offline */
  }
  try {
    const raw = localStorage.getItem(libraryLocalKey(gameCode))
    if (raw) {
      const parsed = JSON.parse(raw) as unknown[]
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeCustomLayout(item))
          .filter((l): l is CustomLayoutDef => Boolean(l))
      }
    }
    const legacy = localStorage.getItem(LEGACY_LIBRARY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown[]
      if (Array.isArray(parsed)) {
        const list = parsed
          .map((item) => normalizeCustomLayout(item))
          .filter((l): l is CustomLayoutDef => Boolean(l))
        if (list.length > 0) {
          await saveLayoutLibrary(gameCode, list)
        }
        return list
      }
    }
  } catch {
    /* ignore */
  }
  return []
}

export async function saveLayoutLibrary(gameCode: string, layouts: CustomLayoutDef[]): Promise<void> {
  localStorage.setItem(libraryLocalKey(gameCode), JSON.stringify(layouts))
  try {
    await fetch(saveApiUrl(gameCode, 'layouts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layouts),
    })
  } catch {
    /* offline */
  }
}

export async function upsertLayoutInLibrary(
  gameCode: string,
  layout: CustomLayoutDef,
): Promise<CustomLayoutDef[]> {
  const list = await loadLayoutLibrary(gameCode)
  const idx = list.findIndex((l) => l.id === layout.id)
  const next = { ...layout, updatedAt: new Date().toISOString() }
  if (idx >= 0) list[idx] = next
  else list.unshift(next)
  await saveLayoutLibrary(gameCode, list)
  return list
}

export async function removeLayoutFromLibrary(
  gameCode: string,
  id: string,
): Promise<CustomLayoutDef[]> {
  const list = (await loadLayoutLibrary(gameCode)).filter((l) => l.id !== id)
  await saveLayoutLibrary(gameCode, list)
  return list
}

export function exportLayoutJson(layout: CustomLayoutDef): void {
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safe = layout.name.replace(/[\\/:*?"<>|]+/g, '_') || 'layout'
  link.download = `${safe}.layout.json`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export async function importLayoutJsonFile(file: File): Promise<CustomLayoutDef> {
  const text = await file.text()
  const parsed = JSON.parse(text) as unknown
  const layout = normalizeCustomLayout(parsed)
  if (!layout) throw new Error('无效的布局文件：缺少 slots 数据')
  return layout
}
