import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  DEFAULT_IMAGE_FOCUS_X,
  DEFAULT_IMAGE_FOCUS_Y,
  clampImageFocus,
} from '../lib/characterArt'

type Props = {
  src: string
  focusX?: number
  focusY?: number
  onChange: (focusX: number, focusY: number) => void
}

export default function CustomImageFocus({ src, focusX, focusY, onChange }: Props) {
  const innerRef = useRef<HTMLDivElement>(null)
  const fx = clampImageFocus(focusX, DEFAULT_IMAGE_FOCUS_X)
  const fy = clampImageFocus(focusY, DEFAULT_IMAGE_FOCUS_Y)

  const applyFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const inner = innerRef.current
      if (!inner) return
      const rect = inner.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = clampImageFocus((clientX - rect.left) / rect.width, DEFAULT_IMAGE_FOCUS_X)
      const y = clampImageFocus((clientY - rect.top) / rect.height, DEFAULT_IMAGE_FOCUS_Y)
      onChange(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000)
    },
    [onChange],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    applyFromClient(e.clientX, e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    applyFromClient(e.clientX, e.clientY)
  }

  return (
    <div className="custom-focus">
      <div className="custom-focus-label">拖动图钉调整自定义图焦点</div>
      <div className="custom-focus-stage">
        <div
          ref={innerRef}
          className="custom-focus-inner"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
        >
          <img className="custom-focus-img" src={src} alt="" draggable={false} />
          <span className="custom-focus-pin" style={{ left: `${fx * 100}%`, top: `${fy * 100}%` }}>
            <span className="custom-focus-pin-dot" />
          </span>
        </div>
      </div>
      <div className="custom-focus-sliders">
        <label className="dim">
          水平 {Math.round(fx * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(fx * 100)}
            onChange={(e) => onChange(Number(e.target.value) / 100, fy)}
          />
        </label>
        <label className="dim">
          垂直 {Math.round(fy * 100)}%
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(fy * 100)}
            onChange={(e) => onChange(fx, Number(e.target.value) / 100)}
          />
        </label>
      </div>
      <button
        type="button"
        className="ghost tiny"
        onClick={() => onChange(DEFAULT_IMAGE_FOCUS_X, DEFAULT_IMAGE_FOCUS_Y)}
      >
        重置焦点
      </button>
    </div>
  )
}
