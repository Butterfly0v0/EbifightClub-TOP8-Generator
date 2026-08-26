import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  fetchCatalog,
  fetchGameCharacters,
  fetchPackConfig,
  matchCharacter,
  matchGame,
  packImagePaths,
  prefetchPaths,
  skinCount,
} from './lib/assets'
import { LAYOUTS, LAYOUT_LIST, builtInLayoutDocDefaults, resolveDocLayout, resolveLayoutAccent } from './lib/layouts'
import { loadLayoutLibrary } from './lib/layoutStorage'
import { HEADER_STYLE_LIST, HEADER_STYLES } from './lib/headers'
import { resolveLayout } from './lib/layoutMetrics'
import {
  EXTRA_CHAR_STYLE_LIST,
  EXTRA_CHAR_STYLES,
  PLAYER_ID_STYLE_LIST,
  PLAYER_ID_STYLES,
} from './lib/slotStyles'
import { MAX_PLAYER_CHARACTERS } from './lib/extraCharLayout'
import { ensureLayoutTexts } from './lib/layoutElements'
import { effectivePosterSettings, layoutSettingsFromDef, type LayoutFieldOverrides } from './lib/layoutDefaults'
import { ExtraCharLayoutEditor, PlayerIdLayoutEditor } from './components/SlotStyleConfigEditor'
import { collectImages, renderTop8 } from './lib/render'
import { buildTop8TweetText, copyTextToClipboard, downloadTweetText } from './lib/top8Tweet'
import { rankLabel } from './lib/rank'
import { saveUserImage } from './lib/userAssets'
import { ensureFontsLoaded } from './lib/fonts'
import FontPicker from './components/FontPicker'
import BoxStyleEditor from './components/BoxStyleEditor'
import EditorSection from './components/EditorSection'
import { defaultDoc, loadDocForGame, saveDoc } from './lib/storage'
import {
  getChallongeApiKey,
  getStartggToken,
  setChallongeApiKey,
  setStartggToken,
} from './lib/importTokens'
import { detectImportSource, importTournament } from './lib/tournamentImport'
import type { ImportSource } from './lib/importTypes'
import LayoutEditor from './components/LayoutEditor'
import GameAssetPickerModal from './components/GameAssetPickerModal'
import type { GameSwitchMode } from './components/GameAssetPickerModal'
import { applyTheme, resolveInitialTheme, setStoredTheme, type UiTheme } from './lib/theme'
import type {
  BuiltInLayoutId,
  Catalog,
  CharacterDef,
  CharacterPick,
  CustomLayoutDef,
  ExtraCharStyleId,
  HeaderStyleId,
  LayoutId,
  PlayerIdStyleId,
  PackConfig,
  PlayerSlot,
  PosterLocale,
  Top8Doc,
} from './types'

export default function App() {
  const [doc, setDoc] = useState<Top8Doc>(() => defaultDoc())
  const [docReady, setDocReady] = useState(false)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [characters, setCharacters] = useState<CharacterDef[]>([])
  const [pack, setPack] = useState<PackConfig | null>(null)
  /** pack 配置实际对应的 packId，避免切换时用旧 prefix 拼新路径 */
  const [packBoundId, setPackBoundId] = useState<string | null>(null)
  const [status, setStatus] = useState('正在加载 StreamHelperAssets 目录…')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [prefetch, setPrefetch] = useState({ done: 0, total: 0, running: false })
  const prefetchedPackKeys = useRef(new Set<string>())
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [importUrl, setImportUrl] = useState('')
  const [startggToken, setStartggTokenState] = useState(getStartggToken)
  const [challongeKey, setChallongeKeyState] = useState(getChallongeApiKey)
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    const theme = resolveInitialTheme()
    applyTheme(theme)
    return theme
  })
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false)
  const [layoutLibrary, setLayoutLibrary] = useState<CustomLayoutDef[]>([])
  const [gamePickerOpen, setGamePickerOpen] = useState(false)
  const detectedSource = useMemo(() => detectImportSource(importUrl), [importUrl])

  const refreshLayoutLibrary = () => {
    void loadLayoutLibrary(doc.gameCode).then(setLayoutLibrary)
  }

  const toggleUiTheme = () => {
    const next: UiTheme = uiTheme === 'dark' ? 'light' : 'dark'
    setUiTheme(next)
    setStoredTheme(next)
  }

  const sourceLabel = (source: ImportSource | null) => {
    if (source === 'startgg') return 'start.gg'
    if (source === 'challonge') return 'Challonge'
    if (source === 'parrygg') return 'parry.gg'
    return null
  }

  const game = catalog?.[doc.gameCode] ?? null
  const activePackMeta = game?.packs.find((p) => p.id === doc.packId) ?? game?.packs[0] ?? null
  const baseLayout = useMemo(() => resolveDocLayout(doc), [doc.layoutId, doc.customLayout])
  const posterSettings = useMemo(() => effectivePosterSettings(doc), [doc])
  const layout = useMemo(
    () => resolveLayout(baseLayout, doc.headerStyleId),
    [baseLayout, doc.headerStyleId],
  )

  useEffect(() => {
    if (!docReady) return
    void saveDoc(doc).then((warn) => {
      if (warn) setError(warn)
    })
  }, [doc, docReady])

  useEffect(() => {
    let cancelled = false
    fetchCatalog()
      .then(async (c) => {
        if (cancelled) return
        setCatalog(c)
        setStatus(`已加载 ${Object.keys(c).length} 款游戏素材`)
        const code = c[doc.gameCode] ? doc.gameCode : c.sf6 ? 'sf6' : Object.keys(c)[0]
        const [loaded, layouts] = await Promise.all([
          loadDocForGame(code),
          loadLayoutLibrary(code),
        ])
        if (cancelled) return
        setDoc(loaded)
        setLayoutLibrary(layouts)
        setDocReady(true)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!game) return
    let cancelled = false
    const packId = game.packs.some((p) => p.id === doc.packId)
      ? doc.packId
      : (game.packs[0]?.id ?? 'full')
    if (packId !== doc.packId) {
      setDoc((d) => ({ ...d, packId }))
      return
    }
    setBusy(true)
    Promise.all([fetchGameCharacters(game.code), fetchPackConfig(game, packId)])
      .then(([chars, packCfg]) => {
        if (cancelled) return
        setCharacters(chars)
        setPack(packCfg)
        setPackBoundId(packId)
        setError('')
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [game, doc.packId])

  useEffect(() => {
    if (!game || !pack || characters.length === 0 || packBoundId !== doc.packId) return
    const packKey = `${game.code}:${doc.packId}`
    const paths = packImagePaths(game, doc.packId, pack, characters)

    if (prefetchedPackKeys.current.has(packKey)) {
      setPrefetch({ done: paths.length, total: paths.length, running: false })
      return
    }

    let cancelled = false
    // 先让画布立绘加载，再后台全量缓存，避免切换素材包时抢带宽
    const run = () => {
      if (cancelled) return
      setPrefetch({ done: 0, total: paths.length, running: true })
      void prefetchPaths(paths, (done, total) => {
        if (!cancelled) setPrefetch({ done, total, running: done < total })
      }).then(() => {
        if (cancelled) return
        prefetchedPackKeys.current.add(packKey)
        setPrefetch((p) => ({ ...p, running: false }))
      })
    }

    let idleHandle: number | undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(run, { timeout: 1200 })
    } else {
      timeoutHandle = setTimeout(run, 250)
    }

    return () => {
      cancelled = true
      if (idleHandle != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle != null) clearTimeout(timeoutHandle)
    }
  }, [game, pack, characters, doc.packId, packBoundId])

  useEffect(() => {
    ensureFontsLoaded(doc.titleFontId, doc.playerFontId, doc.rankFontId)
  }, [doc.titleFontId, doc.playerFontId, doc.rankFontId])

  useEffect(() => {
    if (!pack || packBoundId !== doc.packId) return
    let cancelled = false
    collectImages(doc, game, pack, baseLayout).then((map) => {
      if (!cancelled) setImages(map)
    })
    return () => {
      cancelled = true
    }
  }, [doc, game, pack, baseLayout, packBoundId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cancelled = false
    const draw = () => {
      if (!cancelled) renderTop8(ctx, doc, layout, pack, images, characters)
    }
    draw()
    void document.fonts.ready.then(draw)
    return () => {
      cancelled = true
    }
  }, [doc, layout, pack, images, characters])

  const patch = useCallback((partial: Partial<Top8Doc>) => {
    setDoc((d) => ({ ...d, ...partial }))
  }, [])

  const onGameAssetConfirm = useCallback(
    (nextCode: string, nextPackId: string, _mode: GameSwitchMode) => {
      if (nextCode === doc.gameCode) {
        if (nextPackId !== doc.packId) patch({ packId: nextPackId })
        return
      }
      void (async () => {
        if (docReady) await saveDoc(doc)
        const [loaded, layouts] = await Promise.all([
          loadDocForGame(nextCode),
          loadLayoutLibrary(nextCode),
        ])
        const gameMeta = catalog?.[nextCode]
        const validPack =
          gameMeta?.packs.some((p) => p.id === nextPackId)
            ? nextPackId
            : gameMeta?.packs.find((p) => p.id === 'full')?.id ?? gameMeta?.packs[0]?.id ?? 'full'
        setDoc({ ...loaded, packId: validPack })
        setLayoutLibrary(layouts)
        setDocReady(true)
        setStatus(`已切换至 ${gameMeta?.name ?? nextCode}`)
      })()
    },
    [catalog, doc, docReady, patch],
  )

  const patchWithLayoutOverride = useCallback(
    (override: keyof LayoutFieldOverrides, partial: Partial<Top8Doc>) => {
      setDoc((d) => ({
        ...d,
        ...partial,
        layoutOverrides: { ...d.layoutOverrides, [override]: true },
      }))
    },
    [],
  )

  const patchPlayer = (index: number, partial: Partial<PlayerSlot>) => {
    setDoc((d) => ({
      ...d,
      players: d.players.map((p, i) => (i === index ? { ...p, ...partial } : p)),
    }))
  }

  const onImport = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await importTournament(importUrl)
      const matchedGame = catalog ? matchGame(catalog, result.videogameName) : undefined
      const nextGame = matchedGame ?? game
      let chars = characters
      if (matchedGame && matchedGame.code !== doc.gameCode) {
        chars = await fetchGameCharacters(matchedGame.code)
        setCharacters(chars)
      }
      const players: PlayerSlot[] = result.players.map((p) => ({
        placement: p.placement,
        tag: p.tag,
        prefix: p.prefix,
        twitter: '',
        characters: p.characterNames
          .map((name) => matchCharacter(chars, name))
          .filter((c): c is CharacterDef => Boolean(c))
          .map((c) => ({ codename: c.codename, skin: 0 })),
      }))
      setDoc((d) => ({
        ...d,
        tournamentName: result.tournamentName || d.tournamentName,
        subtitle: result.eventName || d.subtitle,
        date: result.date || d.date,
        numEntrants:
          result.numEntrants != null && result.numEntrants > 0
            ? String(result.numEntrants)
            : d.numEntrants,
        gameCode: nextGame?.code ?? d.gameCode,
        packId: nextGame && nextGame.code !== d.gameCode ? 'full' : d.packId,
        players,
      }))
      const filled = players.filter((p) => p.tag).length
      const from = sourceLabel(result.source) ?? '赛事'
      const charHint =
        result.source === 'startgg' ? '角色来自近期对局，可手动修正。' : '请手动核对/填写角色。'
      setStatus(
        `已从 ${from} 导入 ${filled} 名选手${result.numEntrants ? `（赛事 ${result.numEntrants} 人）` : ''}。${charHint}`,
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void saveUserImage(file, {
      maxEdge: 800,
      quality: 0.9,
      mime: 'image/png',
      prefix: 'logo',
      gameCode: doc.gameCode,
    })
      .then((url) => patch({ logoDataUrl: url }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    e.target.value = ''
  }

  const onBackground = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void saveUserImage(file, { maxEdge: 1920, quality: 0.84, prefix: 'bg', gameCode: doc.gameCode })
      .then((url) => patchWithLayoutOverride('background', { backgroundImageDataUrl: url }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    e.target.value = ''
  }

  const downloadCanvas = (canvas: HTMLCanvasElement, localeTag: string) => {
    const link = document.createElement('a')
    const safe = (doc.tournamentName || 'top8').replace(/[\\/:*?"<>|]+/g, '_')
    link.download = `${safe}-TOP8${localeTag}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const exportPng = async () => {
    await document.fonts.ready
    const canvas = canvasRef.current
    if (!canvas) return
    downloadCanvas(canvas, doc.posterLocale === 'en' ? '-EN' : '')
  }

  /** 不改预览语言，离屏渲染英文版并下载 */
  const exportEnglishPng = async () => {
    await document.fonts.ready
    const off = document.createElement('canvas')
    off.width = layout.width
    off.height = layout.height
    const ctx = off.getContext('2d')
    if (!ctx) return
    renderTop8(ctx, { ...doc, posterLocale: 'en' }, layout, pack, images, characters)
    downloadCanvas(off, '-EN')
  }

  const exportTweetText = async () => {
    const text = buildTop8TweetText(doc, characters)
    try {
      await copyTextToClipboard(text)
      setStatus('TOP8 推文已复制到剪贴板')
    } catch {
      downloadTweetText(text, doc.tournamentName)
      setStatus('无法写入剪贴板，已改为下载 .txt')
    }
  }

  const applyCustomLayout = (custom: CustomLayoutDef) => {
    const layout = ensureLayoutTexts(custom)
    patch({
      layoutId: 'custom',
      customLayout: layout,
      ...layoutSettingsFromDef(layout),
      accent: resolveLayoutAccent(layout),
    })
    setLayoutEditorOpen(false)
    refreshLayoutLibrary()
    setStatus(`已应用自定义布局「${layout.name}」`)
  }

  const layoutSelectValue =
    doc.layoutId === 'custom' && doc.customLayout
      ? `custom:${doc.customLayout.id}`
      : doc.layoutId

  const onLayoutSelect = (value: string) => {
    if (value.startsWith('lib:')) {
      const id = value.slice(4)
      const found = layoutLibrary.find((l) => l.id === id)
      if (found) applyCustomLayout(found)
      return
    }
    if (value.startsWith('custom:')) return
    const layoutId = value as LayoutId
    if (!LAYOUTS[layoutId as keyof typeof LAYOUTS]) return
    patch(builtInLayoutDocDefaults(layoutId as BuiltInLayoutId))
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">EbifightClub</p>
          <h1>TOP8 Generator</h1>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="ghost"
            onClick={toggleUiTheme}
            title={uiTheme === 'dark' ? '切换到白天模式' : '切换到夜晚模式'}
            aria-label={uiTheme === 'dark' ? '切换到白天模式' : '切换到夜晚模式'}
          >
            {uiTheme === 'dark' ? '白天' : '夜晚'}
          </button>
          <button type="button" className="ghost" onClick={() => setLayoutEditorOpen(true)}>
            布局编辑器
          </button>
          <button type="button" className="ghost" onClick={() => setDoc(defaultDoc(doc.gameCode))}>
            重置
          </button>
          <button type="button" className="ghost" onClick={() => void exportTweetText()}>
            导出推文
          </button>
          <button type="button" className="ghost" onClick={() => void exportEnglishPng()} disabled={busy}>
            导出英文 PNG
          </button>
          <button type="button" className="primary" onClick={() => void exportPng()} disabled={busy}>
            导出 PNG
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="panel editor">
          <div className="editor-sections">
            <EditorSection title="赛事信息">
              <label>
                比赛名称
                <input
                  value={doc.tournamentName}
                  onChange={(e) => patch({ tournamentName: e.target.value })}
                />
              </label>
              <label>
                副标题
                <input value={doc.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} />
              </label>
              <div className="row">
                <label>
                  参赛人数
                  <input
                    inputMode="numeric"
                    placeholder="如 32"
                    value={doc.numEntrants}
                    onChange={(e) => patch({ numEntrants: e.target.value.replace(/[^\d]/g, '') })}
                  />
                </label>
                <label>
                  日期
                  <input value={doc.date} onChange={(e) => patch({ date: e.target.value })} />
                </label>
              </div>
              <label>
                海报语言（预览）
                <select
                  value={doc.posterLocale}
                  onChange={(e) => patch({ posterLocale: e.target.value as PosterLocale })}
                >
                  <option value="zh">中文 · N 参赛者</option>
                  <option value="en">English · N participants</option>
                </select>
              </label>
              <p className="hint">也可直接点右上角「导出英文 PNG」，无需切换预览语言。</p>
            </EditorSection>

            <EditorSection title="游戏与素材">
              <button
                type="button"
                className="game-asset-picker-trigger"
                onClick={() => setGamePickerOpen(true)}
                disabled={!catalog}
              >
                <span className="game-asset-picker-thumb-wrap">
                  {doc.gameCode ? (
                    <img
                      className="game-asset-picker-thumb"
                      src={`/api/sha/games/${doc.gameCode}/base_files/logo.png`}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : null}
                </span>
                <span className="game-asset-picker-copy">
                  <span className="game-asset-picker-game">{game?.name ?? doc.gameCode}</span>
                  <span className="game-asset-picker-pack">{activePackMeta?.name ?? doc.packId}</span>
                </span>
                <span className="game-asset-picker-action">更换</span>
              </button>
              <p className="hint">点击选择游戏与素材包，支持搜索筛选。</p>
            </EditorSection>

            <EditorSection title="版式">
              <label>
                布局
                <select value={layoutSelectValue} onChange={(e) => onLayoutSelect(e.target.value)}>
                  <optgroup label="内置模板">
                    {LAYOUT_LIST.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </optgroup>
                  {doc.layoutId === 'custom' && doc.customLayout ? (
                    <optgroup label="当前自定义">
                      <option value={`custom:${doc.customLayout.id}`}>
                        {doc.customLayout.name}
                      </option>
                    </optgroup>
                  ) : null}
                  {layoutLibrary.length > 0 ? (
                    <optgroup label="我的布局库">
                      {layoutLibrary.map((l) => (
                        <option key={l.id} value={`lib:${l.id}`}>
                          {l.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
              <div className="layout-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    refreshLayoutLibrary()
                    setLayoutEditorOpen(true)
                  }}
                >
                  {doc.layoutId === 'custom' ? '编辑当前布局' : '打开布局编辑器'}
                </button>
              </div>
              <label>
                标题栏
                <select
                  value={doc.headerStyleId}
                  onChange={(e) => patch({ headerStyleId: e.target.value as HeaderStyleId })}
                >
                  {HEADER_STYLE_LIST.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint">
                {doc.layoutId === 'custom' && doc.customLayout
                  ? doc.customLayout.description || '自定义布局'
                  : LAYOUTS[doc.layoutId as keyof typeof LAYOUTS]?.description ?? ''}
                {' · '}
                {HEADER_STYLES[doc.headerStyleId].description}
              </p>
              {doc.layoutId !== 'custom' &&
              LAYOUTS[doc.layoutId as keyof typeof LAYOUTS]?.recommendedHeaderStyleId &&
              doc.headerStyleId !==
                LAYOUTS[doc.layoutId as keyof typeof LAYOUTS]?.recommendedHeaderStyleId ? (
                <p className="hint">
                  建议搭配标题栏「
                  {HEADER_STYLES[LAYOUTS[doc.layoutId as keyof typeof LAYOUTS]!.recommendedHeaderStyleId!].name}
                  」
                </p>
              ) : null}
            </EditorSection>

            <EditorSection title="选手框装饰" defaultOpen={false}>
              <div className="row">
                <label>
                  副选角色
                  <select
                    value={posterSettings.extraCharStyleId}
                    onChange={(e) =>
                      patchWithLayoutOverride('extraChar', {
                        extraCharStyleId: e.target.value as ExtraCharStyleId,
                      })
                    }
                  >
                    {EXTRA_CHAR_STYLE_LIST.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  选手 ID
                  <select
                    value={posterSettings.playerIdStyleId}
                    onChange={(e) =>
                      patchWithLayoutOverride('playerId', {
                        playerIdStyleId: e.target.value as PlayerIdStyleId,
                      })
                    }
                  >
                    {PLAYER_ID_STYLE_LIST.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="hint">
                {EXTRA_CHAR_STYLES[posterSettings.extraCharStyleId].description}
                {' · '}
                {PLAYER_ID_STYLES[posterSettings.playerIdStyleId].description}
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={doc.showExtraCharNames}
                  onChange={(e) => patch({ showExtraCharNames: e.target.checked })}
                />
                在 ID 下方显示副角色名
              </label>
              {posterSettings.extraCharStyleId === 'custom' ? (
                <ExtraCharLayoutEditor
                  value={posterSettings.extraCharLayout}
                  onChange={(extraCharLayout) => patchWithLayoutOverride('extraChar', { extraCharLayout })}
                />
              ) : null}
              {posterSettings.playerIdStyleId === 'custom' ? (
                <PlayerIdLayoutEditor
                  value={posterSettings.playerIdLayout}
                  onChange={(playerIdLayout) => patchWithLayoutOverride('playerId', { playerIdLayout })}
                />
              ) : null}
              <div className="row">
                <FontPicker
                  label="标题字体"
                  value={doc.titleFontId}
                  onChange={(titleFontId) => patch({ titleFontId })}
                />
                <FontPicker
                  label="选手字体"
                  value={doc.playerFontId}
                  onChange={(playerFontId) => patch({ playerFontId })}
                />
              </div>
              <FontPicker
                label="名次标签字体"
                value={doc.rankFontId}
                onChange={(rankFontId) => patch({ rankFontId })}
              />
              <label className="dim">
                全局立绘缩放 {Math.round((doc.globalArtScale ?? 1) * 100)}%
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={Math.round((doc.globalArtScale ?? 1) * 100)}
                  onChange={(e) => patch({ globalArtScale: Number(e.target.value) / 100 })}
                />
              </label>
              <p className="hint">统一调整所有选手立绘大小；单个角色可在选手编辑中单独微调。</p>
              <BoxStyleEditor
                label="选手框全局默认"
                value={doc.defaultBoxStyle}
                onChange={(defaultBoxStyle) => patch({ defaultBoxStyle })}
                showExtra
                gameCode={doc.gameCode}
                onError={setError}
              />
              <p className="hint">可在布局编辑器中为每个名次区域单独设置框体主题与装饰图。</p>
            </EditorSection>

            <EditorSection title="配色与背景" defaultOpen={false}>
              <div className="row-3">
                <label>
                  强调色
                  <input type="color" value={doc.accent} onChange={(e) => patch({ accent: e.target.value })} />
                </label>
                <label>
                  背景色
                  <input
                    type="color"
                    value={posterSettings.background}
                    onChange={(e) => patchWithLayoutOverride('background', { background: e.target.value })}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={doc.showCredits}
                    onChange={(e) => patch({ showCredits: e.target.checked })}
                  />
                  显示素材来源
                </label>
              </div>
              <label className="dim">
                选手框底色 {Math.round(doc.playerBoxOpacity * 100)}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(doc.playerBoxOpacity * 100)}
                  onChange={(e) => patch({ playerBoxOpacity: Number(e.target.value) / 100 })}
                />
              </label>
              <p className="hint">0% 完全透出海报背景，100% 为深色底。</p>
              <label>
                自定义背景图
                <input type="file" accept="image/*" onChange={onBackground} />
              </label>
              {posterSettings.backgroundImageDataUrl ? (
                <div className="upload-actions">
                  <label className="dim">
                    背景暗化 {Math.round(posterSettings.backgroundDim * 100)}%
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={Math.round(posterSettings.backgroundDim * 100)}
                      onChange={(e) =>
                        patchWithLayoutOverride('background', {
                          backgroundDim: Number(e.target.value) / 100,
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => patchWithLayoutOverride('background', { backgroundImageDataUrl: '' })}
                  >
                    清除背景图
                  </button>
                </div>
              ) : (
                <p className="hint">未上传时用背景色；上传后铺满画面并可调节暗化。自定义布局可在布局编辑器中设置默认背景。</p>
              )}
              <label>
                自定义 Logo
                <input type="file" accept="image/*" onChange={onLogo} />
              </label>
              {posterSettings.logoDataUrl && doc.logoDataUrl ? (
                <button type="button" className="ghost" onClick={() => patch({ logoDataUrl: '' })}>
                  清除 Logo
                </button>
              ) : null}
            </EditorSection>

            <EditorSection title="选手">
              <div className="players">
                {doc.players.map((player, index) => (
                  <PlayerEditor
                    key={index}
                    player={player}
                    characters={characters}
                    pack={pack}
                    gameCode={doc.gameCode}
                    onChange={(partial) => patchPlayer(index, partial)}
                  />
                ))}
              </div>
            </EditorSection>
          </div>
        </section>

        <section className="preview-wrap">
          <div className="panel import-panel">
            <h2>赛事导入</h2>
            <p className="hint">
              支持 start.gg / Challonge / parry.gg。粘贴链接后自动识别来源
              {detectedSource ? `（当前：${sourceLabel(detectedSource)}）` : ''}。
            </p>
            <form className="import" onSubmit={(e) => void onImport(e)}>
              <input
                placeholder="粘贴赛事链接（start.gg / Challonge / parry.gg）"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
              <button type="submit" className="primary" disabled={busy || !importUrl.trim()}>
                导入 TOP8
              </button>
            </form>
            <div className="row">
              <label>
                start.gg Token（可选）
                <input
                  type="password"
                  value={startggToken}
                  placeholder="限额时填写"
                  onChange={(e) => {
                    setStartggTokenState(e.target.value)
                    setStartggToken(e.target.value.trim())
                  }}
                />
              </label>
              <label>
                Challonge API Key
                <input
                  type="password"
                  value={challongeKey}
                  placeholder="导入 Challonge 时必填"
                  onChange={(e) => {
                    setChallongeKeyState(e.target.value)
                    setChallongeApiKey(e.target.value.trim())
                  }}
                />
              </label>
            </div>
            <p className="hint">
              Challonge 需已完赛；parry.gg 请用 standings 链接（…/_standings），无需 Key。
            </p>
          </div>

          <div className="preview-meta">
            <span>{status}</span>
            {busy ? <span className="pill">加载中</span> : null}
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="preview-frame">
            <canvas ref={canvasRef} width={layout.width} height={layout.height} />
          </div>
          <div className="cdn-row">
            <span>
              {prefetch.total
                ? prefetch.running
                  ? `正在缓存本包素材 ${prefetch.done}/${prefetch.total}`
                  : `本包素材已缓存 ${prefetch.done}/${prefetch.total}`
                : '素材来自'}
            </span>
            <a
              href="https://github.com/joaorb64/StreamHelperAssets"
              target="_blank"
              rel="noreferrer"
            >
              StreamHelperAssets
            </a>
          </div>
        </section>
      </main>

      {catalog ? (
        <GameAssetPickerModal
          open={gamePickerOpen}
          catalog={catalog}
          initialGameCode={doc.gameCode}
          initialPackId={doc.packId}
          title="选择游戏素材"
          onClose={() => setGamePickerOpen(false)}
          onConfirm={onGameAssetConfirm}
        />
      ) : null}

      {layoutEditorOpen && catalog ? (
        <LayoutEditor
          gameCode={doc.gameCode}
          catalog={catalog}
          initial={
            doc.layoutId === 'custom' && doc.customLayout
              ? { ...doc.customLayout, slots: doc.customLayout.slots.map((s) => ({ ...s })) }
              : null
          }
          accent={doc.accent}
          onApply={applyCustomLayout}
          onClose={() => {
            setLayoutEditorOpen(false)
            refreshLayoutLibrary()
          }}
        />
      ) : null}
    </div>
  )
}

function PlayerEditor({
  player,
  characters,
  pack,
  gameCode,
  onChange,
}: {
  player: PlayerSlot
  characters: CharacterDef[]
  pack: PackConfig | null
  gameCode: string
  onChange: (partial: Partial<PlayerSlot>) => void
}) {
  const setChar = (index: number, pick: CharacterPick | null) => {
    const next = [...player.characters]
    if (!pick) next.splice(index, 1)
    else next[index] = pick
    onChange({
      characters: next.filter((c) => c?.codename || c?.customImageDataUrl),
    })
  }

  const onCustomArt = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const current = player.characters[index]
    void saveUserImage(file, { maxEdge: 1400, quality: 0.86, prefix: 'char', gameCode })
      .then((url) => {
        setChar(index, {
          codename: current?.codename ?? '',
          skin: current?.skin ?? 0,
          customImageDataUrl: url,
          artScale: current?.artScale,
        })
      })
      .catch(() => {
        /* ignore decode errors here; parent status shows elsewhere if needed */
      })
    e.target.value = ''
  }

  return (
    <article className="player">
      <header>
        <strong>{rankLabel(player.placement)}</strong>
        <div className="player-names">
          <input
            placeholder="战队 / 前缀"
            value={player.prefix}
            onChange={(e) => onChange({ prefix: e.target.value })}
          />
          <input
            placeholder="选手名"
            value={player.tag}
            onChange={(e) => onChange({ tag: e.target.value })}
          />
        </div>
      </header>
      <label className="dim twitter-field">
        社交账号（所有布局名条下方显示）
        <input
          placeholder="@handle"
          value={player.twitter}
          onChange={(e) => onChange({ twitter: e.target.value })}
        />
      </label>
      <div className="chars">
        {Array.from({ length: Math.max(1, player.characters.length) }, (_, i) => i).map((i) => {
          const current = player.characters[i]
          const skins = current?.codename && pack ? skinCount(pack, current.codename) : 1
          const hasCustom = Boolean(current?.customImageDataUrl)
          const hasArt = Boolean(hasCustom || current?.codename)
          const artScale = current?.artScale ?? 1
          return (
            <div key={i} className="char-block">
              <div className="char-row">
                <select
                  value={current?.codename ?? ''}
                  onChange={(e) => {
                    const codename = e.target.value
                    if (!codename && !current?.customImageDataUrl) {
                      setChar(i, null)
                      return
                    }
                    setChar(i, {
                      codename,
                      skin: 0,
                      customImageDataUrl: current?.customImageDataUrl,
                      artScale: current?.artScale,
                    })
                  }}
                >
                  <option value="">
                    {i === 0 ? '主选角色（素材包）' : `副选 ${i}（素材包）`}
                  </option>
                  {characters.map((c) => (
                    <option key={c.codename} value={c.codename}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {current?.codename && skins > 1 && !hasCustom ? (
                  <select
                    value={String(current.skin)}
                    onChange={(e) =>
                      setChar(i, { ...current, skin: Number(e.target.value) })
                    }
                  >
                    {Array.from({ length: skins }, (_, s) => (
                      <option key={s} value={s}>
                        皮肤 {s + 1}
                      </option>
                    ))}
                  </select>
                ) : null}
                {i > 0 ? (
                  <button
                    type="button"
                    className="ghost tiny danger"
                    onClick={() => setChar(i, null)}
                    title="移除此副角色"
                  >
                    移除
                  </button>
                ) : null}
              </div>
              {hasArt ? (
                <label className="dim char-scale">
                  立绘缩放 {Math.round(artScale * 100)}%
                  <input
                    type="range"
                    min={50}
                    max={250}
                    step={5}
                    value={Math.round(artScale * 100)}
                    onChange={(e) =>
                      setChar(i, {
                        codename: current?.codename ?? '',
                        skin: current?.skin ?? 0,
                        customImageDataUrl: current?.customImageDataUrl,
                        artScale: Number(e.target.value) / 100,
                      })
                    }
                  />
                </label>
              ) : null}
              <div className="char-upload">
                <label className="file-btn">
                  {hasCustom ? '更换自定义图' : '上传自定义图'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => onCustomArt(i, e)}
                  />
                </label>
                {hasCustom ? (
                  <>
                    <span className="pill soft">自定义</span>
                    <button
                      type="button"
                      className="ghost tiny"
                      onClick={() => {
                        if (!current?.codename) setChar(i, null)
                        else setChar(i, { ...current, customImageDataUrl: '' })
                      }}
                    >
                      清除自定义图
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
        {player.characters.length < MAX_PLAYER_CHARACTERS ? (
          <button
            type="button"
            className="ghost add-char-btn"
            onClick={() =>
              onChange({
                characters: [...player.characters, { codename: '', skin: 0 }],
              })
            }
          >
            + 添加副角色（最多 {MAX_PLAYER_CHARACTERS - 1} 个）
          </button>
        ) : null}
      </div>
    </article>
  )
}
