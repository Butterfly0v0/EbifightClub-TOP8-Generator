import type { ChangeEvent } from 'react'
import { BOX_THEME_LIST, normalizeBoxStyle } from '../lib/boxThemes'
import { saveUserImage } from '../lib/userAssets'
import type { BoxStyle } from '../types'

type Props = {
  label: string
  value: BoxStyle | undefined
  onChange: (style: BoxStyle) => void
  showExtra?: boolean
  gameCode?: string
  onError?: (msg: string) => void
}

function OpacitySlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number) => void
}) {
  const pct = Math.round((value ?? 0.85) * 100)
  return (
    <label className="dim">
      {label} {pct}%
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </label>
  )
}

export default function BoxStyleEditor({
  label,
  value,
  onChange,
  showExtra = false,
  gameCode = 'shared',
  onError,
}: Props) {
  const style = normalizeBoxStyle(value)

  const patch = (partial: Partial<BoxStyle>) => onChange({ ...style, ...partial })

  const onFrameUpload = (kind: 'main' | 'extra') => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void saveUserImage(file, {
      maxEdge: 1400,
      quality: 0.9,
      mime: 'image/png',
      prefix: 'box',
      gameCode,
    })
      .then((url) => {
        if (kind === 'main') patch({ theme: 'image', frameImageUrl: url })
        else patch({ extraTheme: 'image', extraFrameImageUrl: url })
      })
      .catch((err: unknown) =>
        onError?.(err instanceof Error ? err.message : String(err)),
      )
    e.target.value = ''
  }

  return (
    <div className="box-style-editor">
      <p className="sub-label">{label}</p>
      <label>
        框体主题
        <select value={style.theme} onChange={(e) => patch({ theme: e.target.value as BoxStyle['theme'] })}>
          {BOX_THEME_LIST.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{BOX_THEME_LIST.find((t) => t.id === style.theme)?.description}</p>

      <OpacitySlider
        label="底色透明度"
        value={style.fillOpacity}
        onChange={(fillOpacity) => patch({ fillOpacity })}
      />
      <div className="row">
        <label>
          底色
          <input
            type="color"
            value={style.fillColor?.startsWith('#') ? style.fillColor : '#14151c'}
            onChange={(e) => patch({ fillColor: e.target.value })}
          />
        </label>
        <label>
          强调/边框色
          <input
            type="color"
            value={style.color ?? style.borderColor ?? '#ff4d2e'}
            onChange={(e) => patch({ color: e.target.value, borderColor: e.target.value })}
          />
        </label>
      </div>
      <div className="row">
        <label>
          边框宽度
          <input
            type="number"
            min={0}
            max={12}
            step={0.5}
            value={style.borderWidth ?? ''}
            placeholder="自动"
            onChange={(e) =>
              patch({ borderWidth: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </label>
        <OpacitySlider
          label="边框透明度"
          value={style.borderOpacity ?? 1}
          onChange={(borderOpacity) => patch({ borderOpacity })}
        />
      </div>

      {style.theme === 'custom' || style.theme === 'image' || style.theme === 'minimal' ? (
        <p className="hint">自定义/极简主题优先使用上方底色与边框色。</p>
      ) : (
        <p className="hint">主题预设控制默认配色；设置底色/强调色可覆盖默认。</p>
      )}

      <label>
        主框装饰图
        <input type="file" accept="image/*" onChange={onFrameUpload('main')} />
      </label>
      {style.frameImageUrl ? (
        <div className="asset-preview-row">
          <img src={style.frameImageUrl} alt="" className="asset-thumb" />
          <button type="button" className="ghost tiny" onClick={() => patch({ frameImageUrl: '' })}>
            清除
          </button>
        </div>
      ) : null}

      {showExtra ? (
        <>
          <label>
            副角色框主题
            <select
              value={style.extraTheme ?? ''}
              onChange={(e) =>
                patch({
                  extraTheme: e.target.value ? (e.target.value as BoxStyle['theme']) : undefined,
                })
              }
            >
              <option value="">沿用主框</option>
              {BOX_THEME_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <OpacitySlider
            label="副框底色透明度"
            value={style.extraFillOpacity}
            onChange={(extraFillOpacity) => patch({ extraFillOpacity })}
          />
          <div className="row">
            <label>
              副框底色
              <input
                type="color"
                value={
                  style.extraFillColor?.startsWith('#')
                    ? style.extraFillColor
                    : style.fillColor?.startsWith('#')
                      ? style.fillColor
                      : '#14151c'
                }
                onChange={(e) => patch({ extraFillColor: e.target.value })}
              />
            </label>
            <label>
              副框强调色
              <input
                type="color"
                value={style.extraColor ?? style.extraBorderColor ?? style.color ?? '#ff4d2e'}
                onChange={(e) =>
                  patch({ extraColor: e.target.value, extraBorderColor: e.target.value })
                }
              />
            </label>
          </div>
          <div className="row">
            <label>
              副框边框宽度
              <input
                type="number"
                min={0}
                max={12}
                step={0.5}
                value={style.extraBorderWidth ?? ''}
                placeholder="自动"
                onChange={(e) =>
                  patch({
                    extraBorderWidth: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              副框圆角
              <input
                type="number"
                min={0}
                max={24}
                value={style.extraBorderRadius ?? ''}
                placeholder="8"
                onChange={(e) =>
                  patch({
                    extraBorderRadius: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <OpacitySlider
            label="副框边框透明度"
            value={style.extraBorderOpacity ?? 1}
            onChange={(extraBorderOpacity) => patch({ extraBorderOpacity })}
          />
          <label>
            副角色框装饰图
            <input type="file" accept="image/*" onChange={onFrameUpload('extra')} />
          </label>
          {style.extraFrameImageUrl ? (
            <div className="asset-preview-row">
              <img src={style.extraFrameImageUrl} alt="" className="asset-thumb" />
              <button
                type="button"
                className="ghost tiny"
                onClick={() => patch({ extraFrameImageUrl: '' })}
              >
                清除
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
