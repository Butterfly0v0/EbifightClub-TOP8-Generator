import type { ExtraCharLayoutConfig, PlayerIdLayoutConfig } from '../types'

type ExtraProps = {
  value: ExtraCharLayoutConfig | undefined
  onChange: (v: ExtraCharLayoutConfig) => void
}

type PlayerIdProps = {
  value: PlayerIdLayoutConfig | undefined
  onChange: (v: PlayerIdLayoutConfig) => void
}

function numInput(
  label: string,
  value: number | undefined,
  onChange: (n: number | undefined) => void,
  opts?: { min?: number; max?: number; step?: number; placeholder?: string },
) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={opts?.min}
        max={opts?.max}
        step={opts?.step}
        value={value ?? ''}
        placeholder={opts?.placeholder ?? '自动'}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
    </label>
  )
}

export function ExtraCharLayoutEditor({ value, onChange }: ExtraProps) {
  const cfg = value ?? {}
  const patch = (partial: Partial<ExtraCharLayoutConfig>) => onChange({ ...cfg, ...partial })

  return (
    <div className="slot-style-config">
      <label>
        排列方式
        <select
          value={cfg.mode ?? 'bottomRow'}
          onChange={(e) => patch({ mode: e.target.value as ExtraCharLayoutConfig['mode'] })}
        >
          <option value="bottomRow">底部横排</option>
          <option value="sideStack">右侧竖排</option>
        </select>
      </label>
      <div className="row">
        {numInput('缩略图尺寸', cfg.thumbSize, (thumbSize) => patch({ thumbSize }), {
          min: 24,
          max: 160,
          placeholder: '自动',
        })}
        {numInput('间距', cfg.gap, (gap) => patch({ gap }), { min: 0, max: 32, placeholder: '自动' })}
      </div>
      <div className="row">
        {numInput('右边距', cfg.paddingRight, (paddingRight) => patch({ paddingRight }), {
          min: 0,
          max: 80,
          placeholder: '自动',
        })}
        {numInput('底边距', cfg.paddingBottom, (paddingBottom) => patch({ paddingBottom }), {
          min: 0,
          max: 80,
          placeholder: '自动',
        })}
      </div>
    </div>
  )
}

export function PlayerIdLayoutEditor({ value, onChange }: PlayerIdProps) {
  const cfg = value ?? {}
  const patch = (partial: Partial<PlayerIdLayoutConfig>) => onChange({ ...cfg, ...partial })

  return (
    <div className="slot-style-config">
      <div className="row">
        {numInput('名条高度', cfg.plateHeight, (plateHeight) => patch({ plateHeight }), {
          min: 0,
          max: 120,
          placeholder: '自动',
        })}
        {numInput('名条间距', cfg.hangGap, (hangGap) => patch({ hangGap }), {
          min: 0,
          max: 24,
          placeholder: '自动',
        })}
      </div>
      <div className="row">
        {numInput('水平内边距', cfg.paddingX, (paddingX) => patch({ paddingX }), {
          min: 0,
          max: 48,
          placeholder: '12',
        })}
        {numInput('名条顶距', cfg.paddingTop, (paddingTop) => patch({ paddingTop }), {
          min: 0,
          max: 48,
          placeholder: '自动',
        })}
      </div>
      <div className="row">
        {numInput(
          '渐变起点',
          cfg.veilStartRatio,
          (veilStartRatio) => patch({ veilStartRatio }),
          { min: 0, max: 1, step: 0.05, placeholder: '0.45' },
        )}
        {numInput('渐变强度', cfg.veilOpacity, (veilOpacity) => patch({ veilOpacity }), {
          min: 0,
          max: 1,
          step: 0.05,
          placeholder: '0.92',
        })}
      </div>
      <p className="hint">叠字模式下渐变起点/强度控制立绘底部暗化；名条高度用于框内/延伸名条模式。</p>
    </div>
  )
}
