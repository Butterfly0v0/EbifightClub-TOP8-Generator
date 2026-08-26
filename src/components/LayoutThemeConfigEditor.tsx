import type { LayoutThemeConfig } from '../types'

type Props = {
  value: LayoutThemeConfig | undefined
  onChange: (v: LayoutThemeConfig) => void
  theme?: string
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
        placeholder={opts?.placeholder ?? '默认'}
        onChange={(e) =>
          onChange(e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
    </label>
  )
}

export default function LayoutThemeConfigEditor({ value, onChange, theme }: Props) {
  const cfg = value ?? {}
  const patch = (partial: Partial<LayoutThemeConfig>) => onChange({ ...cfg, ...partial })
  const showParagon = theme === 'paragon'
  const showAnimefgc = theme === 'animefgc'

  return (
    <div className="slot-style-config">
      <p className="hint compact">留空则使用主题默认值；导出海报与 Canvas 预览均生效。</p>
      <div className="row">
        {numInput('立绘 cover 倍率', cfg.artCoverMultiplier, (artCoverMultiplier) =>
          patch({ artCoverMultiplier }), { min: 0.8, max: 2, step: 0.05, placeholder: '1.15' })}
        {numInput('槽位立绘缩放', cfg.slotArtBoost, (slotArtBoost) => patch({ slotArtBoost }), {
          min: 0.5,
          max: 2.5,
          step: 0.05,
          placeholder: '1',
        })}
      </div>
      <div className="row">
        {numInput(
          '叠字渐变起点',
          cfg.overlayVeilStartRatio,
          (overlayVeilStartRatio) => patch({ overlayVeilStartRatio }),
          { min: 0, max: 1, step: 0.05, placeholder: '0.45' },
        )}
        {numInput(
          '叠字渐变强度',
          cfg.overlayVeilOpacity,
          (overlayVeilOpacity) => patch({ overlayVeilOpacity }),
          { min: 0, max: 1, step: 0.05, placeholder: '0.92' },
        )}
      </div>
      <div className="row">
        {numInput(
          '框内渐变起点',
          cfg.overlayVeilStartRatioInCard,
          (overlayVeilStartRatioInCard) => patch({ overlayVeilStartRatioInCard }),
          { min: 0, max: 1, step: 0.05, placeholder: '0.35' },
        )}
        {numInput(
          '框内渐变强度',
          cfg.overlayVeilOpacityInCard,
          (overlayVeilOpacityInCard) => patch({ overlayVeilOpacityInCard }),
          { min: 0, max: 1, step: 0.05, placeholder: '0.55' },
        )}
      </div>
      {numInput('推特条高度', cfg.twitterStripH, (twitterStripH) => patch({ twitterStripH }), {
        min: 0,
        max: 64,
        placeholder: '28',
      })}
      {showParagon ? (
        <div className="row">
          {numInput(
            '冠军名条高度',
            cfg.paragonChampPlateH,
            (paragonChampPlateH) => patch({ paragonChampPlateH }),
            { min: 24, max: 120, placeholder: '52' },
          )}
          {numInput(
            '其他名次名条高度',
            cfg.paragonPlateH,
            (paragonPlateH) => patch({ paragonPlateH }),
            { min: 20, max: 100, placeholder: '40' },
          )}
        </div>
      ) : null}
      {showAnimefgc ? (
        <>
          <div className="row">
            {numInput(
              '冠军底栏高度',
              cfg.animefgcChampBarH,
              (animefgcChampBarH) => patch({ animefgcChampBarH }),
              { min: 40, max: 120, placeholder: '72' },
            )}
            {numInput(
              '冠军渐变起点',
              cfg.animefgcChampVeilStart,
              (animefgcChampVeilStart) => patch({ animefgcChampVeilStart }),
              { min: 0, max: 1, step: 0.05, placeholder: '0.38' },
            )}
          </div>
          <div className="row">
            {numInput(
              '冠军立绘加成',
              cfg.animefgcChampArtBoost,
              (animefgcChampArtBoost) => patch({ animefgcChampArtBoost }),
              { min: 0.5, max: 2.5, step: 0.05, placeholder: '1.08' },
            )}
            {numInput(
              '列表立绘加成',
              cfg.animefgcListArtBoost,
              (animefgcListArtBoost) => patch({ animefgcListArtBoost }),
              { min: 0.5, max: 2.5, step: 0.05, placeholder: '1.22' },
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
