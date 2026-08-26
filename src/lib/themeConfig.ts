import type { LayoutTheme, LayoutThemeConfig, Top8Doc } from '../types'

export const THEME_CONFIG_DEFAULTS: Required<LayoutThemeConfig> = {
  artCoverMultiplier: 1.15,
  slotArtBoost: 1,
  overlayVeilStartRatio: 0.45,
  overlayVeilStartRatioInCard: 0.35,
  overlayVeilOpacity: 0.92,
  overlayVeilOpacityInCard: 0.55,
  twitterStripH: 28,
  paragonChampPlateH: 52,
  paragonPlateH: 40,
  animefgcChampBarH: 72,
  animefgcChampArtBoost: 1.08,
  animefgcListArtBoost: 1.22,
  animefgcChampVeilStart: 0.38,
}

export function defaultThemeConfigForTheme(theme?: LayoutTheme): LayoutThemeConfig {
  switch (theme) {
    case 'paragon':
      return {
        paragonChampPlateH: 52,
        paragonPlateH: 40,
        overlayVeilStartRatio: 0.35,
        overlayVeilOpacity: 0.55,
      }
    case 'animefgc':
      return {
        animefgcChampBarH: 72,
        animefgcChampArtBoost: 1.08,
        animefgcListArtBoost: 1.22,
        animefgcChampVeilStart: 0.38,
      }
    case 'tokon':
      return {
        overlayVeilStartRatio: 0.45,
        overlayVeilOpacity: 0.92,
        slotArtBoost: 1,
      }
    case 'ebifc':
      return {
        overlayVeilStartRatio: 0.55,
        overlayVeilOpacity: 0.72,
        slotArtBoost: 1.06,
        twitterStripH: 22,
      }
    default:
      return {}
  }
}

export function normalizeThemeConfig(raw: Partial<LayoutThemeConfig> | undefined): LayoutThemeConfig {
  if (!raw || typeof raw !== 'object') return {}
  const clamp = (n: unknown, min: number, max: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined
  const out: LayoutThemeConfig = {}
  const artCoverMultiplier = clamp(raw.artCoverMultiplier, 0.8, 2)
  const slotArtBoost = clamp(raw.slotArtBoost, 0.5, 2.5)
  const overlayVeilStartRatio = clamp(raw.overlayVeilStartRatio, 0, 1)
  const overlayVeilStartRatioInCard = clamp(raw.overlayVeilStartRatioInCard, 0, 1)
  const overlayVeilOpacity = clamp(raw.overlayVeilOpacity, 0, 1)
  const overlayVeilOpacityInCard = clamp(raw.overlayVeilOpacityInCard, 0, 1)
  const twitterStripH = clamp(raw.twitterStripH, 0, 64)
  const paragonChampPlateH = clamp(raw.paragonChampPlateH, 24, 120)
  const paragonPlateH = clamp(raw.paragonPlateH, 20, 100)
  const animefgcChampBarH = clamp(raw.animefgcChampBarH, 40, 120)
  const animefgcChampArtBoost = clamp(raw.animefgcChampArtBoost, 0.5, 2.5)
  const animefgcListArtBoost = clamp(raw.animefgcListArtBoost, 0.5, 2.5)
  const animefgcChampVeilStart = clamp(raw.animefgcChampVeilStart, 0, 1)
  if (artCoverMultiplier !== undefined) out.artCoverMultiplier = artCoverMultiplier
  if (slotArtBoost !== undefined) out.slotArtBoost = slotArtBoost
  if (overlayVeilStartRatio !== undefined) out.overlayVeilStartRatio = overlayVeilStartRatio
  if (overlayVeilStartRatioInCard !== undefined) out.overlayVeilStartRatioInCard = overlayVeilStartRatioInCard
  if (overlayVeilOpacity !== undefined) out.overlayVeilOpacity = overlayVeilOpacity
  if (overlayVeilOpacityInCard !== undefined) out.overlayVeilOpacityInCard = overlayVeilOpacityInCard
  if (twitterStripH !== undefined) out.twitterStripH = twitterStripH
  if (paragonChampPlateH !== undefined) out.paragonChampPlateH = paragonChampPlateH
  if (paragonPlateH !== undefined) out.paragonPlateH = paragonPlateH
  if (animefgcChampBarH !== undefined) out.animefgcChampBarH = animefgcChampBarH
  if (animefgcChampArtBoost !== undefined) out.animefgcChampArtBoost = animefgcChampArtBoost
  if (animefgcListArtBoost !== undefined) out.animefgcListArtBoost = animefgcListArtBoost
  if (animefgcChampVeilStart !== undefined) out.animefgcChampVeilStart = animefgcChampVeilStart
  return out
}

/** 合并布局推荐值与全局默认，供 render 读取 */
export function effectiveThemeConfig(doc: Top8Doc): Required<LayoutThemeConfig> {
  const layout = doc.layoutId === 'custom' ? doc.customLayout : null
  const themeDefaults = defaultThemeConfigForTheme(layout?.theme)
  const custom = normalizeThemeConfig(layout?.recommendedThemeConfig)
  // 勿把 undefined 覆盖进默认值（Object.assign / spread 会覆盖）
  const merged: Required<LayoutThemeConfig> = { ...THEME_CONFIG_DEFAULTS }
  for (const [key, value] of Object.entries({ ...themeDefaults, ...custom }) as Array<
    [keyof LayoutThemeConfig, number | undefined]
  >) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      merged[key] = value
    }
  }
  return merged
}

export function themeVal(
  cfg: Required<LayoutThemeConfig>,
  key: keyof LayoutThemeConfig,
): number {
  return cfg[key] ?? THEME_CONFIG_DEFAULTS[key]
}
