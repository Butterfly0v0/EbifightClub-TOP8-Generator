import { HEADER_STYLES } from './headers'
import type { HeaderStyleId, Layout, LayoutSlot } from '../types'

function gridBounds(slots: LayoutSlot[]) {
  const minY = Math.min(...slots.map((s) => s.y))
  const maxY = Math.max(...slots.map((s) => s.y + s.h))
  return { minY, maxY, height: maxY - minY }
}

/** 按标题栏样式在可用区域内垂直居中选手区 */
export function resolveLayoutSlots(
  layout: Layout,
  headerStyleId: HeaderStyleId = 'compact',
): LayoutSlot[] {
  const style = HEADER_STYLES[headerStyleId] ?? HEADER_STYLES.compact
  const bounds = gridBounds(layout.slots)
  const availH = style.contentBottom - style.contentTop
  const dy = style.contentTop + Math.max(0, (availH - bounds.height) / 2) - bounds.minY
  if (Math.abs(dy) < 0.5) return layout.slots
  return layout.slots.map((s) => ({ ...s, y: s.y + dy }))
}

export function resolveLayout(
  layout: Layout,
  headerStyleId: HeaderStyleId = 'compact',
): Layout {
  return { ...layout, slots: resolveLayoutSlots(layout, headerStyleId) }
}
