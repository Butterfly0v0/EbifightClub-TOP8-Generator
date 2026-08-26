import type {
  ExtraCharLayoutConfig,
  ExtraCharStyleId,
  LayoutSlot,
  PlayerIdLayoutConfig,
  PlayerIdStyleId,
} from '../types'

export type ExtraBoxRect = { x: number; y: number; w: number; h: number; label: string }

export const MAX_EXTRA_CHARACTERS = 12
export const MAX_PLAYER_CHARACTERS = MAX_EXTRA_CHARACTERS + 1

/** 将 custom 解析为实际绘制用的 ID 样式 */
export function resolveEffectivePlayerIdStyle(
  idStyle: PlayerIdStyleId,
  layout?: PlayerIdLayoutConfig,
): 'overlay' | 'inCard' | 'hang' {
  if (idStyle !== 'custom') return idStyle
  const plateH = layout?.plateHeight ?? 68
  if (plateH <= 0) return 'overlay'
  if ((layout?.hangGap ?? 0) > 0) return 'hang'
  return 'inCard'
}

function plateHeight(
  idStyle: PlayerIdStyleId,
  place: number,
  hasRoster: boolean,
  custom?: PlayerIdLayoutConfig,
): number {
  if (idStyle === 'overlay') return 0
  if (custom?.plateHeight != null) return custom.plateHeight
  if (idStyle === 'hang') {
    return hasRoster ? (place === 1 ? 76 : 64) : place === 1 ? 56 : 48
  }
  if (idStyle === 'custom') {
    return custom?.plateHeight ?? (place === 1 ? 68 : 52)
  }
  return place === 1 ? 68 : 52
}

export function resolveHangGap(idStyle: PlayerIdStyleId, custom?: PlayerIdLayoutConfig): number {
  const effective = resolveEffectivePlayerIdStyle(idStyle, custom)
  if (effective === 'hang') return custom?.hangGap ?? 3
  return 0
}

export function resolveArtHeight(
  slot: LayoutSlot,
  place: number,
  idStyle: PlayerIdStyleId,
  hasRoster: boolean,
  custom?: PlayerIdLayoutConfig,
): number {
  const effective = resolveEffectivePlayerIdStyle(idStyle, custom)
  const plateH = plateHeight(idStyle, place, hasRoster, custom)
  const hangGap = resolveHangGap(idStyle, custom)
  return effective === 'overlay' ? slot.h : slot.h - plateH - hangGap
}

export function resolveExtraCharMode(
  styleId: ExtraCharStyleId,
  config?: ExtraCharLayoutConfig,
): 'bottomRow' | 'sideStack' {
  if (styleId === 'sideStack') return 'sideStack'
  if (styleId === 'custom') return config?.mode ?? 'bottomRow'
  return 'bottomRow'
}

export function resolveSideThumbSize(
  place: number,
  slot: LayoutSlot,
  artH: number,
  extraCount: number,
  config?: ExtraCharLayoutConfig,
): number {
  const thumbGap = config?.gap ?? 6
  let thumbSize =
    config?.thumbSize ??
    (place === 1 ? 72 : slot.h >= 400 ? 58 : 46)
  const needed = extraCount * thumbSize + (extraCount - 1) * thumbGap
  if (needed > artH - 16) {
    thumbSize = Math.max(28, Math.floor((artH - 16 - (extraCount - 1) * thumbGap) / extraCount))
  }
  return thumbSize
}

export function resolveBottomThumbSize(
  place: number,
  slot: LayoutSlot,
  config?: ExtraCharLayoutConfig,
): number {
  if (config?.thumbSize != null) return config.thumbSize
  return place === 1 ? 92 : slot.h >= 240 ? 72 : 58
}

export function computeSideStripWidth(thumbSize: number): number {
  return thumbSize + 14
}

/** 与 render.ts 一致的副角色框位置，供渲染与布局编辑器预览 */
export function computeExtraCharBoxes(
  slot: LayoutSlot,
  opts: {
    place: number
    extraCharStyleId: ExtraCharStyleId
    playerIdStyleId: PlayerIdStyleId
    extraCount: number
    hasRoster?: boolean
    extraCharLayout?: ExtraCharLayoutConfig
    playerIdLayout?: PlayerIdLayoutConfig
  },
): ExtraBoxRect[] {
  const {
    place,
    extraCharStyleId,
    playerIdStyleId,
    extraCount,
    hasRoster = false,
    extraCharLayout,
    playerIdLayout,
  } = opts
  if (extraCount <= 0) return []

  const mode = resolveExtraCharMode(extraCharStyleId, extraCharLayout)
  const artH = resolveArtHeight(slot, place, playerIdStyleId, hasRoster, playerIdLayout)

  if (mode === 'sideStack') {
    const thumbGap = extraCharLayout?.gap ?? 6
    const thumbSize = resolveSideThumbSize(place, slot, artH, extraCount, extraCharLayout)
    const padRight = extraCharLayout?.paddingRight ?? 8
    const stripX = slot.x + slot.w - thumbSize - padRight
    const totalH = extraCount * thumbSize + (extraCount - 1) * thumbGap
    let ty = slot.y + Math.max(8, (artH - totalH) / 2)
    return Array.from({ length: extraCount }, (_, i) => {
      const rect = { x: stripX, y: ty, w: thumbSize, h: thumbSize, label: `副${i + 1}` }
      ty += thumbSize + thumbGap
      return rect
    })
  }

  const size = resolveBottomThumbSize(place, slot, extraCharLayout)
  const gap = extraCharLayout?.gap ?? 8
  const padRight = extraCharLayout?.paddingRight ?? 16
  const padBottom = extraCharLayout?.paddingBottom ?? 0
  const effectiveId = resolveEffectivePlayerIdStyle(playerIdStyleId, playerIdLayout)
  const boxesLeft = slot.x + slot.w - padRight - extraCount * size - (extraCount - 1) * gap
  const bottomInset = effectiveId === 'overlay' ? 18 + padBottom : 10 + padBottom
  const bottomY = slot.y + (effectiveId === 'overlay' ? slot.h : artH) - bottomInset

  return Array.from({ length: extraCount }, (_, i) => ({
    x: boxesLeft + i * (size + gap),
    y: bottomY - size,
    w: size,
    h: size,
    label: `副${i + 1}`,
  }))
}
