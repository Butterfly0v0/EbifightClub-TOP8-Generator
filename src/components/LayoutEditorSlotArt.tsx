import type { ArtRect } from '../lib/layoutEditorPreview'
import { resolveArtScale, resolveEyesight } from '../lib/layoutEditorPreview'
import type { CharacterPick, LayoutSlot, PackConfig, Point } from '../types'
import type { PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  slot: LayoutSlot
  artRect: ArtRect
  relArt: ArtRect
  scale: number
  img?: HTMLImageElement | null
  pick?: CharacterPick | null
  pack?: PackConfig | null
  showPlaceholder?: boolean
  dimmed?: boolean
  focusMode?: boolean
  focusActive?: boolean
  onFocusPointerDown?: (e: ReactPointerEvent) => void
}

function characterTransform(
  img: HTMLImageElement,
  art: ArtRect,
  focusX: number,
  focusY: number,
  eyes: Point | undefined,
  artScale: number,
  scale: number,
) {
  const cover =
    Math.max(art.w / img.naturalWidth, art.h / img.naturalHeight) *
    1.15 *
    resolveArtScale(artScale)
  const dw = img.naturalWidth * cover
  const dh = img.naturalHeight * cover
  const ex = eyes?.x ?? img.naturalWidth / 2
  const ey = eyes?.y ?? img.naturalHeight * 0.28
  const fx = art.w * focusX
  const fy = art.h * focusY
  return {
    width: dw * scale,
    height: dh * scale,
    left: (fx - ex * cover) * scale,
    top: (fy - ey * cover) * scale,
  }
}

export default function LayoutEditorSlotArt({
  slot,
  relArt,
  scale,
  img,
  pick,
  pack,
  showPlaceholder = true,
  dimmed = false,
  focusMode = false,
  focusActive = false,
  onFocusPointerDown,
}: Props) {
  const eyes =
    pick?.codename && pack && !pick.customImageDataUrl
      ? resolveEyesight(pack, pick.codename, pick.skin ?? 0)
      : undefined

  return (
    <div
      className={`layout-slot-art-clip${focusMode ? ' focus-mode' : ''}${dimmed ? ' dimmed' : ''}${focusActive ? ' active' : ''}`}
      style={{
        left: relArt.x * scale,
        top: relArt.y * scale,
        width: relArt.w * scale,
        height: relArt.h * scale,
        borderRadius: Math.max(0, slot.radius * scale - 1),
      }}
      onPointerDown={focusMode ? onFocusPointerDown : undefined}
    >
      {img && img.naturalWidth > 0 ? (
        <img
          className="layout-slot-art-img"
          src={img.src}
          alt=""
          draggable={false}
          style={characterTransform(
            img,
            relArt,
            slot.focusX,
            slot.focusY,
            eyes,
            pick?.artScale ?? 1,
            scale,
          )}
        />
      ) : showPlaceholder ? (
        <div className="layout-slot-art-placeholder">
          <span>立绘区域</span>
        </div>
      ) : null}
      {focusMode ? (
        <>
          <div className="layout-slot-art-grid" aria-hidden="true" />
          <div
            className={`layout-focus-pin${focusActive ? ' active' : ''}`}
            style={{
              left: relArt.w * slot.focusX * scale,
              top: relArt.h * slot.focusY * scale,
            }}
            onPointerDown={onFocusPointerDown}
          >
            <span className="layout-focus-pin-dot" />
            <span className="layout-focus-pin-label">焦点</span>
          </div>
        </>
      ) : null}
    </div>
  )
}
