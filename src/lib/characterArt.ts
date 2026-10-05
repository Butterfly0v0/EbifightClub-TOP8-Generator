import type { CharacterPick, PackConfig, PlayerSlot, Point } from '../types'
import { MAX_EXTRA_CHARACTERS } from './extraCharLayout'

export const DEFAULT_IMAGE_FOCUS_X = 0.5
export const DEFAULT_IMAGE_FOCUS_Y = 0.28

export function hasCharArt(ch: CharacterPick | undefined): ch is CharacterPick {
  return Boolean(ch?.customImageDataUrl || ch?.codename)
}

export function clampImageFocus(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}

export function eyesightOf(pack: PackConfig, codename: string, skin: number): Point | undefined {
  return pack.eyesights?.[codename]?.[String(skin)] ?? pack.eyesights?.[codename]?.['0']
}

/** 自定义图用 imageFocus；素材包用 eyesight。返回图上的像素点。 */
export function resolvePickEyes(
  pick: CharacterPick | undefined,
  pack: PackConfig | null,
  img: { width: number; height: number },
): Point | undefined {
  if (!pick) return undefined
  if (pick.customImageDataUrl) {
    const fx = clampImageFocus(pick.imageFocusX, DEFAULT_IMAGE_FOCUS_X)
    const fy = clampImageFocus(pick.imageFocusY, DEFAULT_IMAGE_FOCUS_Y)
    return { x: img.width * fx, y: img.height * fy }
  }
  if (!pick.codename || !pack) return undefined
  return eyesightOf(pack, pick.codename, pick.skin)
}

/**
 * 绘制用副角色列表：主位使用自定义图且已选素材包角色时，
 * 将该角色作为第一个副角色（素材包立绘）显示。
 */
export function extraCharactersForRender(player: PlayerSlot): CharacterPick[] {
  const main = player.characters[0]
  const rest = player.characters.slice(1).filter(hasCharArt)
  const extras: CharacterPick[] = []
  if (main?.customImageDataUrl && main.codename) {
    const already = rest.some((c) => c.codename === main.codename)
    if (!already && rest.length < MAX_EXTRA_CHARACTERS) {
      extras.push({
        codename: main.codename,
        skin: main.skin,
      })
    }
  }
  extras.push(...rest)
  return extras.slice(0, MAX_EXTRA_CHARACTERS)
}
