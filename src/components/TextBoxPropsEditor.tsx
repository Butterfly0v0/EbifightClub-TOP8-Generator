import type { ImageBoxLayout, TextBoxLayout, TextContentSource } from '../types'

type ContentSourceOption = { id: TextContentSource; label: string }

type Props = {
  label: string
  value: TextBoxLayout
  onChange: (v: TextBoxLayout) => void
  contentSources?: ContentSourceOption[]
  onDelete?: () => void
}

export default function TextBoxPropsEditor({
  label,
  value,
  onChange,
  contentSources,
  onDelete,
}: Props) {
  const patch = (partial: Partial<TextBoxLayout>) => onChange({ ...value, ...partial })
  const contentMode = value.contentMode === 'fixed' ? 'fixed' : 'auto'

  return (
    <div className="text-box-props">
      <div className="text-box-props-head">
        <p className="sub-label">{label}</p>
        {onDelete ? (
          <button type="button" className="ghost tiny danger" onClick={onDelete}>
            删除
          </button>
        ) : null}
      </div>
      {contentSources ? (
        <>
          <label>
            内容来源
            <select
              value={contentMode}
              onChange={(e) =>
                patch({ contentMode: e.target.value === 'fixed' ? 'fixed' : 'auto' })
              }
            >
              <option value="auto">自动获取</option>
              <option value="fixed">固定文字</option>
            </select>
          </label>
          {contentMode === 'auto' ? (
            <label>
              自动字段
              <select
                value={value.contentSource ?? contentSources[0]?.id ?? ''}
                onChange={(e) =>
                  patch({ contentSource: e.target.value as TextContentSource })
                }
              >
                {contentSources.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              固定文字
              <input
                value={value.fixedText ?? ''}
                onChange={(e) => patch({ fixedText: e.target.value })}
                placeholder="输入要显示的固定内容"
              />
            </label>
          )}
        </>
      ) : null}
      <p className="hint compact">拖拽预览区移动；需要精确数值时展开下方选项。</p>
      <div className="row">
        <label>
          字号
          <input
            type="number"
            min={8}
            max={120}
            value={value.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          />
        </label>
        <label>
          颜色
          <input
            type="color"
            value={value.color?.startsWith('#') ? value.color : '#f7f3ea'}
            onChange={(e) => patch({ color: e.target.value })}
          />
        </label>
      </div>
      <div className="row">
        <label>
          对齐
          <select
            value={value.align ?? 'left'}
            onChange={(e) => patch({ align: e.target.value as TextBoxLayout['align'] })}
          >
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>
        </label>
        <label className="check inline-check">
          <input
            type="checkbox"
            checked={value.visible !== false}
            onChange={(e) => patch({ visible: e.target.checked })}
          />
          显示
        </label>
      </div>
      <details className="le-details">
        <summary>精确位置与大小</summary>
        <div className="row">
          <label>
            X
            <input type="number" value={Math.round(value.x)} onChange={(e) => patch({ x: Number(e.target.value) })} />
          </label>
          <label>
            Y
            <input type="number" value={Math.round(value.y)} onChange={(e) => patch({ y: Number(e.target.value) })} />
          </label>
        </div>
        <div className="row">
          <label>
            宽
            <input type="number" value={Math.round(value.w)} onChange={(e) => patch({ w: Number(e.target.value) })} />
          </label>
          <label>
            高
            <input type="number" value={Math.round(value.h)} onChange={(e) => patch({ h: Number(e.target.value) })} />
          </label>
        </div>
      </details>
    </div>
  )
}

export function ImageBoxPropsEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value: ImageBoxLayout
  onChange: (v: ImageBoxLayout) => void
}) {
  const patch = (partial: Partial<ImageBoxLayout>) => onChange({ ...value, ...partial })

  return (
    <div className="text-box-props">
      <p className="sub-label">{label}</p>
      <p className="hint compact">拖拽预览区移动 Logo 框。</p>
      <label className="check inline-check">
        <input
          type="checkbox"
          checked={value.visible !== false}
          onChange={(e) => patch({ visible: e.target.checked })}
        />
        显示
      </label>
      <details className="le-details">
        <summary>精确位置与大小</summary>
        <div className="row">
          <label>
            X
            <input type="number" value={Math.round(value.x)} onChange={(e) => patch({ x: Number(e.target.value) })} />
          </label>
          <label>
            Y
            <input type="number" value={Math.round(value.y)} onChange={(e) => patch({ y: Number(e.target.value) })} />
          </label>
        </div>
        <div className="row">
          <label>
            宽
            <input type="number" value={Math.round(value.w)} onChange={(e) => patch({ w: Number(e.target.value) })} />
          </label>
          <label>
            高
            <input type="number" value={Math.round(value.h)} onChange={(e) => patch({ h: Number(e.target.value) })} />
          </label>
        </div>
      </details>
    </div>
  )
}
