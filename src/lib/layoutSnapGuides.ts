import { defaultSlotTextLayout } from './layoutElements'
import type { CustomLayoutDef, ImageBoxLayout, TextBoxLayout } from '../types'

export const POSTER_W = 1920
export const POSTER_H = 1080
export const SNAP_THRESHOLD = 8

export type SnapRect = { x: number; y: number; w: number; h: number }

export type SnapGuideLine = {
  orientation: 'vertical' | 'horizontal'
  /** 画布坐标 */
  position: number
  start: number
  end: number
}

type DragMode =
  | 'move'
  | 'resize-se'
  | 'resize-sw'
  | 'resize-ne'
  | 'resize-nw'
  | 'resize-e'
  | 'resize-w'
  | 'resize-n'
  | 'resize-s'

export type EditorSnapTarget =
  | { kind: 'header' }
  | { kind: 'credits' }
  | { kind: 'header-text'; key: string }
  | { kind: 'header-extra'; id: string }
  | { kind: 'header-image'; key: string }
  | { kind: 'slot'; index: number }
  | { kind: 'slot-text'; index: number; key: string }
  | { kind: 'slot-extra'; index: number; id: string }

export type SnapContext = {
  space: 'canvas' | 'relative'
  targets: SnapRect[]
  canvasOffset: { x: number; y: number }
}

function asRect(box: TextBoxLayout | ImageBoxLayout): SnapRect {
  return { x: box.x, y: box.y, w: box.w, h: box.h }
}

function toCanvas(rect: SnapRect, offset: { x: number; y: number }): SnapRect {
  return { x: rect.x + offset.x, y: rect.y + offset.y, w: rect.w, h: rect.h }
}

function collectAxisValues(rects: SnapRect[]): { xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  for (const r of rects) {
    xs.push(r.x, r.x + r.w / 2, r.x + r.w)
    ys.push(r.y, r.y + r.h / 2, r.y + r.h)
  }
  return { xs, ys }
}

function canvasBoundsTargets(): SnapRect[] {
  return [
    { x: 0, y: 0, w: POSTER_W, h: POSTER_H },
    { x: POSTER_W / 2, y: POSTER_H / 2, w: 0, h: 0 },
  ]
}

function parentBounds(parent: SnapRect): SnapRect[] {
  return [
    { x: 0, y: 0, w: parent.w, h: parent.h },
    { x: parent.w / 2, y: parent.h / 2, w: 0, h: 0 },
  ]
}

export function buildSnapContext(layout: CustomLayoutDef, target: EditorSnapTarget): SnapContext {
  const theme = layout.theme ?? 'default'

  if (target.kind === 'header-text' || target.kind === 'header-image' || target.kind === 'header-extra') {
    const parent = layout.header
    const targets: SnapRect[] = [...parentBounds(parent)]
    const ht = layout.headerTexts
    if (ht) {
      for (const [key, box] of Object.entries(ht)) {
        if (key === 'extras' || !box || (box as TextBoxLayout).visible === false) continue
        if (
          (target.kind === 'header-text' && target.key === key) ||
          (target.kind === 'header-image' && target.key === key)
        ) {
          continue
        }
        targets.push(asRect(box as TextBoxLayout | ImageBoxLayout))
      }
      if (ht.extras) {
        for (const box of ht.extras) {
          if (box.visible === false || (target.kind === 'header-extra' && target.id === box.id)) continue
          targets.push(asRect(box))
        }
      }
    }
    return { space: 'relative', targets, canvasOffset: { x: parent.x, y: parent.y } }
  }

  if (target.kind === 'slot-text' || target.kind === 'slot-extra') {
    const slot = layout.slots[target.index]
    const targets: SnapRect[] = [...parentBounds(slot)]
    const tl = slot.textLayout ?? defaultSlotTextLayout(slot, theme)
    for (const [key, box] of Object.entries(tl)) {
      if (key === 'extras' || !box || (box as TextBoxLayout).visible === false) continue
      if (target.kind === 'slot-text' && target.key === key) continue
      targets.push(asRect(box as TextBoxLayout))
    }
    if (tl.extras) {
      for (const box of tl.extras) {
        if (box.visible === false || (target.kind === 'slot-extra' && target.id === box.id)) continue
        targets.push(asRect(box))
      }
    }
    return { space: 'relative', targets, canvasOffset: { x: slot.x, y: slot.y } }
  }

  const targets: SnapRect[] = [...canvasBoundsTargets()]

  if (target.kind !== 'header') {
    targets.push({
      x: layout.header.x,
      y: layout.header.y,
      w: layout.header.w,
      h: layout.header.h,
    })
  }

  layout.slots.forEach((slot, i) => {
    if (target.kind === 'slot' && target.index === i) return
    targets.push({ x: slot.x, y: slot.y, w: slot.w, h: slot.h })
  })

  if (layout.creditsText && layout.creditsText.visible !== false && target.kind !== 'credits') {
    targets.push(asRect(layout.creditsText))
  }

  return { space: 'canvas', targets, canvasOffset: { x: 0, y: 0 } }
}

function movingXEdges(rect: SnapRect, mode: DragMode): number[] {
  switch (mode) {
    case 'move':
      return [rect.x, rect.x + rect.w / 2, rect.x + rect.w]
    case 'resize-e':
    case 'resize-se':
    case 'resize-ne':
      return [rect.x + rect.w]
    case 'resize-w':
    case 'resize-sw':
    case 'resize-nw':
      return [rect.x]
    default:
      return [rect.x, rect.x + rect.w]
  }
}

function movingYEdges(rect: SnapRect, mode: DragMode): number[] {
  switch (mode) {
    case 'move':
      return [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
    case 'resize-s':
    case 'resize-se':
    case 'resize-sw':
      return [rect.y + rect.h]
    case 'resize-n':
    case 'resize-ne':
    case 'resize-nw':
      return [rect.y]
    default:
      return [rect.y, rect.y + rect.h]
  }
}

function snapDelta(values: number[], targets: number[], threshold: number): number {
  let best = 0
  let bestAbs = threshold + 1
  for (const v of values) {
    for (const t of targets) {
      const d = t - v
      const abs = Math.abs(d)
      if (abs <= threshold && abs < bestAbs) {
        bestAbs = abs
        best = d
      }
    }
  }
  return best
}

function applySnapDelta(rect: SnapRect, mode: DragMode, dx: number, dy: number): SnapRect {
  const next = { ...rect }
  switch (mode) {
    case 'move':
      next.x += dx
      next.y += dy
      break
    case 'resize-se':
      next.w += dx
      next.h += dy
      break
    case 'resize-sw':
      next.x += dx
      next.w -= dx
      next.h += dy
      break
    case 'resize-ne':
      next.y += dy
      next.w += dx
      next.h -= dy
      break
    case 'resize-nw':
      next.x += dx
      next.y += dy
      next.w -= dx
      next.h -= dy
      break
    case 'resize-e':
      next.w += dx
      break
    case 'resize-w':
      next.x += dx
      next.w -= dx
      break
    case 'resize-n':
      next.y += dy
      next.h -= dy
      break
    case 'resize-s':
      next.h += dy
      break
  }
  return next
}

const X_EDGE_KINDS = ['left', 'centerX', 'right'] as const
const Y_EDGE_KINDS = ['top', 'centerY', 'bottom'] as const

function edgeValues(rect: SnapRect): {
  left: number
  centerX: number
  right: number
  top: number
  centerY: number
  bottom: number
} {
  return {
    left: rect.x,
    centerX: rect.x + rect.w / 2,
    right: rect.x + rect.w,
    top: rect.y,
    centerY: rect.y + rect.h / 2,
    bottom: rect.y + rect.h,
  }
}

function buildGuideLines(
  moving: SnapRect,
  compareRects: SnapRect[],
  canvasOffset: { x: number; y: number },
): SnapGuideLine[] {
  const movingCanvas = toCanvas(moving, canvasOffset)
  const all = [movingCanvas, ...compareRects.map((r) => toCanvas(r, canvasOffset))]
  const guides: SnapGuideLine[] = []
  const eps = 0.6

  for (const kind of X_EDGE_KINDS) {
    const val = edgeValues(movingCanvas)[kind]
    const aligned = all.filter((r) => Math.abs(edgeValues(r)[kind] - val) <= eps)
    if (aligned.length < 2) continue
    const ys = aligned.flatMap((r) => [r.y, r.y + r.h])
    guides.push({
      orientation: 'vertical',
      position: val,
      start: Math.min(...ys),
      end: Math.max(...ys),
    })
  }

  for (const kind of Y_EDGE_KINDS) {
    const val = edgeValues(movingCanvas)[kind]
    const aligned = all.filter((r) => Math.abs(edgeValues(r)[kind] - val) <= eps)
    if (aligned.length < 2) continue
    const xs = aligned.flatMap((r) => [r.x, r.x + r.w])
    guides.push({
      orientation: 'horizontal',
      position: val,
      start: Math.min(...xs),
      end: Math.max(...xs),
    })
  }

  return guides
}

export function applySnapGuides(
  rect: SnapRect,
  mode: DragMode,
  ctx: SnapContext,
  threshold = SNAP_THRESHOLD,
): { rect: SnapRect; guides: SnapGuideLine[] } {
  const { xs, ys } = collectAxisValues(ctx.targets)
  const dx = snapDelta(movingXEdges(rect, mode), xs, threshold)
  const dy = snapDelta(movingYEdges(rect, mode), ys, threshold)
  const snapped = applySnapDelta(rect, mode, dx, dy)
  const guides = buildGuideLines(snapped, ctx.targets, ctx.canvasOffset)
  return { rect: snapped, guides }
}

export function readSnapGuidesEnabled(): boolean {
  try {
    return localStorage.getItem('layout-editor-snap-guides') !== '0'
  } catch {
    return true
  }
}

export function writeSnapGuidesEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('layout-editor-snap-guides', enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

const STAGE_ZOOM_KEY = 'layout-editor-stage-zoom'

export function readStageZoom(): number {
  try {
    const v = Number(localStorage.getItem(STAGE_ZOOM_KEY))
    if (Number.isFinite(v) && v >= 50 && v <= 200) return v
  } catch {
    /* ignore */
  }
  return 100
}

export function writeStageZoom(zoom: number): void {
  try {
    localStorage.setItem(STAGE_ZOOM_KEY, String(Math.round(zoom)))
  } catch {
    /* ignore */
  }
}
