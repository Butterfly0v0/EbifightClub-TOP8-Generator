import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { importFontFile, listImportedFonts, removeImportedFont } from '../lib/customFonts'
import {
  ensureFontLoaded,
  FONT_PRESETS,
  fontFamily,
  fontLabel,
  systemFontId,
} from '../lib/fonts'
import {
  filterSystemFonts,
  loadSystemFonts,
  supportsLocalFontAccess,
  type SystemFontEntry,
} from '../lib/systemFonts'

type Props = {
  label: string
  value: string
  onChange: (id: string) => void
}

type Tab = 'preset' | 'system' | 'imported'

const PREVIEW_TEXT = 'TOP 8 · 选手名 Player'

export default function FontPicker({ label, value, onChange }: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('preset')
  const [query, setQuery] = useState('')
  const [systemFonts, setSystemFonts] = useState<SystemFontEntry[]>([])
  const [systemLoading, setSystemLoading] = useState(false)
  const [systemError, setSystemError] = useState<string | null>(null)
  const [importedVersion, setImportedVersion] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [manualFamily, setManualFamily] = useState('')

  const importedFonts = useMemo(() => listImportedFonts(), [importedVersion])

  const selectFont = useCallback(
    (id: string) => {
      ensureFontLoaded(id)
      onChange(id)
      setOpen(false)
      setQuery('')
    },
    [onChange],
  )

  const loadSystem = useCallback(async () => {
    if (!supportsLocalFontAccess()) {
      setSystemError('当前浏览器不支持读取系统字体，请在下方手动输入字体名称。')
      return
    }
    setSystemLoading(true)
    setSystemError(null)
    try {
      const fonts = await loadSystemFonts()
      setSystemFonts(fonts)
      if (fonts.length === 0) {
        setSystemError('未读取到系统字体，请检查浏览器权限。')
      }
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : '读取系统字体失败')
    } finally {
      setSystemLoading(false)
    }
  }, [])

  useEffect(() => {
    ensureFontLoaded(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => {
      document.removeEventListener('pointerdown', onDocPointer)
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (open && tab === 'system' && systemFonts.length === 0 && !systemLoading && !systemError) {
      void loadSystem()
    }
  }, [open, tab, systemFonts.length, systemLoading, systemError, loadSystem])

  const q = query.trim().toLowerCase()

  const presetItems = useMemo(() => {
    if (!q) return FONT_PRESETS
    return FONT_PRESETS.filter(
      (f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q),
    )
  }, [q])

  const systemItems = useMemo(() => filterSystemFonts(systemFonts, query), [systemFonts, query])

  const importedItems = useMemo(() => {
    if (!q) return importedFonts
    return importedFonts.filter((f) => f.displayName.toLowerCase().includes(q))
  }, [importedFonts, q])

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setImportError(null)
    try {
      const font = await importFontFile(file)
      setImportedVersion((v) => v + 1)
      selectFont(font.id)
      setTab('imported')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  const applyManualFamily = () => {
    const family = manualFamily.trim()
    if (!family) return
    selectFont(systemFontId(family))
  }

  const previewFamily = fontFamily(value)

  return (
    <div className="font-picker" ref={rootRef}>
      <span className="font-picker-label">{label}</span>
      <button
        type="button"
        className="font-picker-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-picker-trigger-name" style={{ fontFamily: previewFamily }}>
          {fontLabel(value)}
        </span>
        <span className="font-picker-trigger-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="font-picker-panel" id={listId} role="listbox" aria-label={`${label} 字体列表`}>
          <input
            ref={searchRef}
            type="search"
            className="font-picker-search"
            placeholder="搜索字体名称…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索字体"
          />

          <div className="font-picker-tabs" role="tablist" aria-label="字体来源">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'preset'}
              className={tab === 'preset' ? 'active' : ''}
              onClick={() => setTab('preset')}
            >
              内置
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'system'}
              className={tab === 'system' ? 'active' : ''}
              onClick={() => setTab('system')}
            >
              系统
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'imported'}
              className={tab === 'imported' ? 'active' : ''}
              onClick={() => setTab('imported')}
            >
              导入
            </button>
          </div>

          <div className="font-picker-list">
            {tab === 'preset' ? (
              presetItems.length > 0 ? (
                presetItems.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={value === f.id}
                    className={`font-picker-item${value === f.id ? ' selected' : ''}`}
                    style={{ fontFamily: f.family }}
                    onClick={() => selectFont(f.id)}
                  >
                    <span className="font-picker-item-name">{f.name}</span>
                    <span className="font-picker-item-preview">{PREVIEW_TEXT}</span>
                  </button>
                ))
              ) : (
                <p className="font-picker-empty">没有匹配的内置字体</p>
              )
            ) : null}

            {tab === 'system' ? (
              <>
                {!supportsLocalFontAccess() ? (
                  <p className="hint compact font-picker-hint">
                    当前浏览器不支持自动枚举系统字体（需 Chrome / Edge 等 Chromium 内核）。可手动输入本机已安装的字体名称。
                  </p>
                ) : null}
                {systemError ? <p className="font-picker-error">{systemError}</p> : null}
                {systemLoading ? <p className="font-picker-empty">正在读取系统字体…</p> : null}
                {!systemLoading && supportsLocalFontAccess() && systemFonts.length === 0 ? (
                  <button type="button" className="ghost font-picker-reload" onClick={() => void loadSystem()}>
                    重新加载系统字体
                  </button>
                ) : null}
                {systemItems.length > 0 ? (
                  systemItems.map((f) => {
                    const id = systemFontId(f.family)
                    return (
                      <button
                        key={f.family}
                        type="button"
                        role="option"
                        aria-selected={value === id}
                        className={`font-picker-item${value === id ? ' selected' : ''}`}
                        style={{ fontFamily: `"${f.family.replace(/"/g, '\\"')}", sans-serif` }}
                        onClick={() => selectFont(id)}
                      >
                        <span className="font-picker-item-name">{f.family}</span>
                        <span className="font-picker-item-meta">
                          {f.styles.length} 个字重/样式
                        </span>
                        <span className="font-picker-item-preview">{PREVIEW_TEXT}</span>
                      </button>
                    )
                  })
                ) : !systemLoading && systemFonts.length > 0 ? (
                  <p className="font-picker-empty">没有匹配的系统字体</p>
                ) : null}
                <div className="font-picker-manual">
                  <label>
                    手动输入字体名
                    <input
                      type="text"
                      value={manualFamily}
                      placeholder='例如 "Microsoft YaHei"'
                      onChange={(e) => setManualFamily(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyManualFamily()
                      }}
                    />
                  </label>
                  <button type="button" className="ghost" onClick={applyManualFamily} disabled={!manualFamily.trim()}>
                    使用
                  </button>
                </div>
              </>
            ) : null}

            {tab === 'imported' ? (
              <>
                <div className="font-picker-import-row">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                    className="sr-only"
                    onChange={(e) => void onImportFile(e)}
                  />
                  <button
                    type="button"
                    className="ghost"
                    disabled={importing}
                    onClick={() => fileRef.current?.click()}
                  >
                    {importing ? '导入中…' : '从文件导入字体'}
                  </button>
                  <span className="font-picker-import-hint">.ttf / .otf / .woff / .woff2，最大 5MB</span>
                </div>
                {importError ? <p className="font-picker-error">{importError}</p> : null}
                {importedItems.length > 0 ? (
                  importedItems.map((f) => (
                    <div key={f.id} className={`font-picker-item-row${value === f.id ? ' selected' : ''}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={value === f.id}
                        className="font-picker-item"
                        style={{ fontFamily: `"${f.faceFamily}", sans-serif` }}
                        onClick={() => selectFont(f.id)}
                      >
                        <span className="font-picker-item-name">{f.displayName}</span>
                        <span className="font-picker-item-preview">{PREVIEW_TEXT}</span>
                      </button>
                      <button
                        type="button"
                        className="ghost tiny danger font-picker-remove"
                        title="删除导入的字体"
                        onClick={() => {
                          removeImportedFont(f.id)
                          setImportedVersion((v) => v + 1)
                          if (value === f.id) onChange('noto-sans')
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="font-picker-empty">尚未导入字体</p>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
