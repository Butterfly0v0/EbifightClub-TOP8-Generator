export function resolveArtScale(scale?: number): number {
  if (scale == null || Number.isNaN(scale)) return 1
  return Math.min(2.5, Math.max(0.5, scale))
}

/** 全局缩放 × 单角色缩放，结果限制在 0.5–2.5 */
export function combinedArtScale(perChar?: number, global?: number): number {
  return Math.min(2.5, Math.max(0.5, resolveArtScale(perChar) * resolveArtScale(global)))
}
