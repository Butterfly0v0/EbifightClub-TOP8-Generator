import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { LAYOUT_LIST, layoutFromTemplate, emptyCustomLayout, resolveLayoutAccent } from '../lib/layouts'
import {
  exportLayoutJson,
  importLayoutJsonFile,
  loadLayoutLibrary,
  removeLayoutFromLibrary,
  upsertLayoutInLibrary,
} from '../lib/layoutStorage'
import { saveUserImage } from '../lib/userAssets'
import { ensureFontsLoaded } from '../lib/fonts'
import { defaultHeaderRegion, DEFAULT_HEADER_BG, HEADER_STYLE_LIST } from '../lib/headers'
import { computeExtraCharBoxes, MAX_EXTRA_CHARACTERS } from '../lib/extraCharLayout'
import {
  colorWithOpacity,
  normalizeBoxStyle,
  resolveBorderOpacity,
  resolveBorderWidth,
  resolveBoxAccent,
  resolveBoxFill,
  resolveExtraBoxFill,
} from '../lib/boxThemes'
import { EXTRA_CHAR_STYLE_LIST, PLAYER_ID_STYLE_LIST } from '../lib/slotStyles'
import FontPicker from './FontPicker'
import BoxStyleEditor from './BoxStyleEditor'
import LayoutEditorSection from './LayoutEditorSection'
import { ExtraCharLayoutEditor, PlayerIdLayoutEditor } from './SlotStyleConfigEditor'
import { rankLabel } from '../lib/rank'
import {
  HEADER_CONTENT_SOURCE_OPTIONS,
  HEADER_IMAGE_LABELS,
  HEADER_TEXT_LABELS,
  SLOT_CONTENT_SOURCE_OPTIONS,
  SLOT_TEXT_LABELS,
  defaultCreditsText,
  defaultHeaderTexts,
  defaultSlotTextLayout,
  ensureLayoutTexts,
  newCustomTextBox,
  resolveCreditsText,
  textBoxEditorLabel,
  type HeaderImageKey,
  type HeaderTextKey,
  type SlotTextKey,
} from '../lib/layoutElements'
import TextBoxPropsEditor, { ImageBoxPropsEditor } from './TextBoxPropsEditor'
import {
  applySnapGuides,
  buildSnapContext,
  readSnapGuidesEnabled,
  readStageZoom,
  writeSnapGuidesEnabled,
  writeStageZoom,
  type SnapGuideLine,
} from '../lib/layoutSnapGuides'
import LayoutEditorSlotArt from './LayoutEditorSlotArt'
import GameAssetPickerModal from './GameAssetPickerModal'
import {
  artRectRelativeToSlot,
  buildSamplePreviewBundle,
  computeSlotArtRect,
  loadPreviewAssetContext,
  loadPreviewLogos,
  loadSampleCharacterImages,
  readPreviewGameCode,
  readPreviewPackId,
  readPreviewSampleEnabled,
  resolveEditorTextBoxPreview,
  writePreviewGameCode,
  writePreviewPackId,
  writePreviewSampleEnabled,
  type SamplePreviewBundle,
} from '../lib/layoutEditorPreview'
import { normalizeThemeConfig } from '../lib/themeConfig'
import LayoutThemeConfigEditor from './LayoutThemeConfigEditor'
import type {
  BuiltInLayoutId,
  Catalog,
  CharacterDef,
  CustomLayoutDef,
  ExtraCharStyleId,
  GameMeta,
  HeaderRegion,
  HeaderStyleId,
  ImageBoxLayout,
  LayoutSlot,
  PackConfig,
  PlayerIdStyleId,
  TextBoxLayout,
  Top8Doc,
} from '../types'

const POSTER_W = 1920
const POSTER_H = 1080
const HANDLE = 10

type DragMode = 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw' | 'resize-e' | 'resize-w' | 'resize-n' | 'resize-s'

type EditorTarget =
  | { kind: 'header' }
  | { kind: 'credits' }
  | { kind: 'header-text'; key: HeaderTextKey }
  | { kind: 'header-extra'; id: string }
  | { kind: 'header-image'; key: HeaderImageKey }
  | { kind: 'slot'; index: number }
  | { kind: 'slot-text'; index: number; key: SlotTextKey }
  | { kind: 'slot-extra'; index: number; id: string }
  | { kind: 'focus'; index: number }

type EditorSelection = EditorTarget | null

type DragState = {
  target: EditorTarget
  mode: DragMode
  startX: number
  startY: number
  orig: { x: number; y: number; w: number; h: number }
}

function isSameSelection(a: EditorSelection, b: EditorTarget): boolean {
  if (!a) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'slot' && b.kind === 'slot') return a.index === b.index
  if (a.kind === 'slot-text' && b.kind === 'slot-text')
    return a.index === b.index && a.key === b.key
  if (a.kind === 'slot-extra' && b.kind === 'slot-extra')
    return a.index === b.index && a.id === b.id
  if (a.kind === 'focus' && b.kind === 'focus') return a.index === b.index
  if (a.kind === 'header-text' && b.kind === 'header-text') return a.key === b.key
  if (a.kind === 'header-extra' && b.kind === 'header-extra') return a.id === b.id
  if (a.kind === 'header-image' && b.kind === 'header-image') return a.key === b.key
  return a.kind === b.kind
}

function clampTextBox(t: TextBoxLayout): TextBoxLayout {
  const rect = clampRect(t, 16, 12)
  return { ...t, ...rect }
}

function clampImageBox(t: ImageBoxLayout): ImageBoxLayout {
  const rect = clampRect(t, 16, 16)
  return { ...t, ...rect }
}

type EditMode = 'boxes' | 'text' | 'focus'

type FocusDragState = {
  index: number
  artRect: { x: number; y: number; w: number; h: number }
}

function selectionJumpValue(sel: EditorSelection): string {
  if (!sel) return 'global'
  if (sel.kind === 'header' || sel.kind === 'header-text' || sel.kind === 'header-image' || sel.kind === 'header-extra') return 'header'
  if (sel.kind === 'credits') return 'credits'
  if (sel.kind === 'slot' || sel.kind === 'slot-text' || sel.kind === 'slot-extra' || sel.kind === 'focus') return `slot-${sel.index}`
  return 'global'
}

function normalizeSelectionForMode(sel: EditorSelection, mode: EditMode): EditorSelection {
  if (!sel) return sel
  if (mode === 'focus') {
    if (
      sel.kind === 'header' ||
      sel.kind === 'header-text' ||
      sel.kind === 'header-extra' ||
      sel.kind === 'header-image' ||
      sel.kind === 'credits'
    ) {
      return null
    }
    if (sel.kind === 'slot' || sel.kind === 'slot-text' || sel.kind === 'slot-extra') return { kind: 'focus', index: sel.index }
    return sel
  }
  if (mode === 'text') {
    if (sel.kind === 'header' || sel.kind === 'slot' || sel.kind === 'focus') return null
    return sel
  }
  if (sel.kind === 'header-text' || sel.kind === 'header-extra' || sel.kind === 'header-image') return { kind: 'header' }
  if (sel.kind === 'credits') return null
  if (sel.kind === 'slot-text' || sel.kind === 'slot-extra' || sel.kind === 'focus') return { kind: 'slot', index: sel.index }
  return sel
}

type Props = {
  gameCode: string
  catalog: Catalog
  initial: CustomLayoutDef | null
  accent?: string
  onApply: (layout: CustomLayoutDef) => void
  onClose: () => void
}

function snap(n: number, step = 4): number {
  return Math.round(n / step) * step
}

function clampRect(
  r: { x: number; y: number; w: number; h: number },
  minW = 40,
  minH = 24,
): { x: number; y: number; w: number; h: number } {
  const w = Math.max(minW, Math.min(r.w, POSTER_W - r.x))
  const h = Math.max(minH, Math.min(r.h, POSTER_H - r.y))
  const x = Math.max(0, Math.min(r.x, POSTER_W - w))
  const y = Math.max(0, Math.min(r.y, POSTER_H - h))
  return { x, y, w, h }
}

function clampSlot(s: LayoutSlot): LayoutSlot {
  const rect = clampRect(s, 40, 40)
  return { ...s, ...rect }
}

function clampHeader(h: HeaderRegion): HeaderRegion {
  const rect = clampRect(h, 80, 32)
  return { ...h, ...rect }
}

function hitTestHandleRect(
  sx: number,
  sy: number,
  rect: { x: number; y: number; w: number; h: number },
  scale: number,
): DragMode | null {
  const x = rect.x * scale
  const y = rect.y * scale
  const w = rect.w * scale
  const h = rect.h * scale
  const right = x + w
  const bottom = y + h
  const near = (a: number, b: number) => Math.abs(a - b) <= HANDLE

  if (near(sx, x) && near(sy, y)) return 'resize-nw'
  if (near(sx, right) && near(sy, y)) return 'resize-ne'
  if (near(sx, x) && near(sy, bottom)) return 'resize-sw'
  if (near(sx, right) && near(sy, bottom)) return 'resize-se'
  if (near(sx, right) && sy >= y && sy <= bottom) return 'resize-e'
  if (near(sx, x) && sy >= y && sy <= bottom) return 'resize-w'
  if (near(sy, y) && sx >= x && sx <= right) return 'resize-n'
  if (near(sy, bottom) && sx >= x && sx <= right) return 'resize-s'
  return null
}

function applyRectDrag(
  orig: { x: number; y: number; w: number; h: number },
  mode: DragMode,
  dx: number,
  dy: number,
): { x: number; y: number; w: number; h: number } {
  let next = { ...orig }
  switch (mode) {
    case 'move':
      next.x = snap(orig.x + dx)
      next.y = snap(orig.y + dy)
      break
    case 'resize-se':
      next.w = snap(orig.w + dx)
      next.h = snap(orig.h + dy)
      break
    case 'resize-sw':
      next.x = snap(orig.x + dx)
      next.w = snap(orig.w - dx)
      next.h = snap(orig.h + dy)
      break
    case 'resize-ne':
      next.y = snap(orig.y + dy)
      next.w = snap(orig.w + dx)
      next.h = snap(orig.h - dy)
      break
    case 'resize-nw':
      next.x = snap(orig.x + dx)
      next.y = snap(orig.y + dy)
      next.w = snap(orig.w - dx)
      next.h = snap(orig.h - dy)
      break
    case 'resize-e':
      next.w = snap(orig.w + dx)
      break
    case 'resize-w':
      next.x = snap(orig.x + dx)
      next.w = snap(orig.w - dx)
      break
    case 'resize-n':
      next.y = snap(orig.y + dy)
      next.h = snap(orig.h - dy)
      break
    case 'resize-s':
      next.h = snap(orig.h + dy)
      break
  }
  return next
}

export default function LayoutEditor({
  gameCode,
  catalog,
  initial,
  accent: _accent = '#ff4d2e',
  onApply,
  onClose,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<CustomLayoutDef>(
    ensureLayoutTexts(initial ?? layoutFromTemplate('classic')),
  )
  const [layout, setLayout] = useState<CustomLayoutDef>(() => layoutRef.current)
  const [library, setLibrary] = useState<CustomLayoutDef[]>([])
  const [editMode, setEditMode] = useState<EditMode>('boxes')
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [snapGuides, setSnapGuides] = useState<SnapGuideLine[]>([])
  const [snapGuidesEnabled, setSnapGuidesEnabled] = useState(readSnapGuidesEnabled)
  const [autoStageWidth, setAutoStageWidth] = useState(880)
  const [stageZoom, setStageZoom] = useState(readStageZoom)
  const [previewSampleEnabled, setPreviewSampleEnabled] = useState(readPreviewSampleEnabled)
  const [previewGameCode, setPreviewGameCode] = useState(() => readPreviewGameCode(gameCode))
  const [previewPackId, setPreviewPackId] = useState(() => readPreviewPackId('full'))
  const [previewGamePickerOpen, setPreviewGamePickerOpen] = useState(false)
  const [previewAssets, setPreviewAssets] = useState<{
    game: GameMeta
    packId: string
    pack: PackConfig
    characters: CharacterDef[]
  } | null>(null)
  const [sampleImages, setSampleImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const [sampleLogos, setSampleLogos] = useState<{
    gameLogo: HTMLImageElement | null
    customLogo: HTMLImageElement | null
  }>({ gameLogo: null, customLogo: null })
  const [focusDrag, setFocusDrag] = useState<FocusDragState | null>(null)
  const [error, setError] = useState('')

  const stageWidth = Math.round(
    Math.max(320, Math.min(POSTER_W, autoStageWidth * (stageZoom / 100))),
  )
  const scale = stageWidth / POSTER_W
  const stageHeight = POSTER_H * scale

  layoutRef.current = layout

  useEffect(() => {
    void loadLayoutLibrary(gameCode).then(setLibrary)
  }, [gameCode])

  useEffect(() => {
    void loadPreviewAssetContext(previewGameCode, previewPackId)
      .then(setPreviewAssets)
      .catch(() => setPreviewAssets(null))
  }, [previewGameCode, previewPackId])

  const onPreviewGameAssetConfirm = (nextCode: string, nextPackId: string) => {
    setPreviewGameCode(nextCode)
    setPreviewPackId(nextPackId)
    writePreviewGameCode(nextCode)
    writePreviewPackId(nextPackId)
  }

  const sampleBundle = useMemo((): SamplePreviewBundle | null => {
    if (!previewAssets?.characters.length) return null
    return buildSamplePreviewBundle(previewAssets.characters)
  }, [previewAssets])

  const sampleCharNames = useMemo(() => {
    const map = new Map<string, string>()
    previewAssets?.characters.forEach((c) => map.set(c.codename, c.name))
    return map
  }, [previewAssets])

  useEffect(() => {
    if (!previewSampleEnabled || !previewAssets) {
      setSampleImages(new Map())
      return
    }
    let cancelled = false
    void loadSampleCharacterImages(
      previewAssets.game,
      previewAssets.packId,
      previewAssets.pack,
      previewAssets.characters,
      layout.slots.length,
      layout.previewExtraCount ?? 2,
    ).then((imgs) => {
      if (!cancelled) setSampleImages(imgs)
    })
    return () => {
      cancelled = true
    }
  }, [previewSampleEnabled, previewAssets, layout.slots.length, layout.previewExtraCount])

  useEffect(() => {
    if (!previewSampleEnabled) {
      setSampleLogos({ gameLogo: null, customLogo: null })
      return
    }
    let cancelled = false
    void loadPreviewLogos(
      previewGameCode,
      layout.customLogoDataUrl || '',
    ).then((logos) => {
      if (!cancelled) setSampleLogos(logos)
    })
    return () => {
      cancelled = true
    }
  }, [previewSampleEnabled, previewGameCode, layout.customLogoDataUrl])

  useEffect(() => {
    const el = stageRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setAutoStageWidth(Math.max(320, entry.contentRect.width - 24))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onStageZoomChange = (zoom: number) => {
    setStageZoom(zoom)
    writeStageZoom(zoom)
  }

  const onPreviewSampleToggle = (enabled: boolean) => {
    setPreviewSampleEnabled(enabled)
    writePreviewSampleEnabled(enabled)
  }

  const editorAccent = useMemo(() => resolveLayoutAccent(layout), [layout])

  const selectedSlot =
    selection?.kind === 'slot' ||
    selection?.kind === 'slot-text' ||
    selection?.kind === 'focus'
      ? layout.slots[selection.index]
      : undefined
  const selectedSlotIndex =
    selection?.kind === 'slot' ||
    selection?.kind === 'slot-text' ||
    selection?.kind === 'focus'
      ? selection.index
      : -1

  const patchLayout = useCallback((partial: Partial<CustomLayoutDef>) => {
    setLayout((l) => ({ ...l, ...partial, updatedAt: new Date().toISOString() }))
  }, [])

  const patchSlot = useCallback((index: number, partial: Partial<LayoutSlot>) => {
    setLayout((l) => ({
      ...l,
      updatedAt: new Date().toISOString(),
      slots: l.slots.map((s, i) => (i === index ? clampSlot({ ...s, ...partial }) : s)),
    }))
  }, [])

  const applyFocusDrag = useCallback(
    (clientX: number, clientY: number, state: FocusDragState) => {
      const stageRect = stageRef.current?.getBoundingClientRect()
      if (!stageRect) return
      const x = (clientX - stageRect.left) / scale
      const y = (clientY - stageRect.top) / scale
      const { artRect, index } = state
      const focusX = Math.max(0, Math.min(1, (x - artRect.x) / artRect.w))
      const focusY = Math.max(0, Math.min(1, (y - artRect.y) / artRect.h))
      patchSlot(index, {
        focusX: Math.round(focusX * 1000) / 1000,
        focusY: Math.round(focusY * 1000) / 1000,
      })
    },
    [scale, patchSlot],
  )

  const loadTemplate = (id: BuiltInLayoutId | 'blank') => {
    const next = id === 'blank' ? emptyCustomLayout() : layoutFromTemplate(id)
    setLayout(next)
    setSelection(null)
    setError('')
  }

  const loadFromLibrary = (id: string) => {
    const found = library.find((l) => l.id === id)
    if (found) {
      setLayout(ensureLayoutTexts({ ...found, slots: found.slots.map((s) => ({ ...s })) }))
      setSelection(null)
    }
  }

  useEffect(() => {
    ensureFontsLoaded(layout.titleFontId, layout.playerFontId, layout.rankFontId)
  }, [layout.titleFontId, layout.playerFontId, layout.rankFontId])

  const previewDoc = useMemo(
    (): Pick<Top8Doc, 'accent' | 'defaultBoxStyle' | 'playerBoxOpacity'> => ({
      accent: editorAccent,
      defaultBoxStyle: layout.defaultBoxStyle ?? { theme: 'rank' },
      playerBoxOpacity: 1,
    }),
    [editorAccent, layout.defaultBoxStyle],
  )

  const activeHeaderStyle =
    layout.headerStyleId ?? layout.recommendedHeaderStyleId ?? 'compact'
  const extraCharStyleId: ExtraCharStyleId =
    layout.recommendedExtraCharStyleId ?? 'bottomRow'
  const playerIdStyleId: PlayerIdStyleId = layout.recommendedPlayerIdStyleId ?? 'overlay'
  const previewExtraCount = layout.previewExtraCount ?? 2

  const addHeaderTextBox = () => {
    const ht =
      layout.headerTexts ?? defaultHeaderTexts(layout.header, activeHeaderStyle, layout.width)
    const box = newCustomTextBox({
      x: 40,
      y: Math.max(8, layout.header.h / 2 - 14),
      w: 220,
      h: 28,
      fontSize: 22,
      contentSource: 'tournamentName',
      label: '自定义标题文字',
    })
    patchLayout({ headerTexts: { ...ht, extras: [...(ht.extras ?? []), box] } })
    setSelection({ kind: 'header-extra', id: box.id! })
  }

  const addSlotTextBox = (index: number) => {
    const slot = layout.slots[index]
    const tl = slot.textLayout ?? defaultSlotTextLayout(slot, layout.theme ?? 'default')
    const box = newCustomTextBox({
      x: 16,
      y: Math.max(8, slot.h / 2 - 12),
      w: Math.max(120, slot.w - 32),
      h: 24,
      fontSize: 16,
      contentSource: 'tag',
      label: '自定义选手文字',
    })
    patchSlot(index, { textLayout: { ...tl, extras: [...(tl.extras ?? []), box] } })
    setSelection({ kind: 'slot-extra', index, id: box.id! })
  }

  const switchEditMode = (mode: EditMode) => {
    setEditMode(mode)
    setSelection((sel) => normalizeSelectionForMode(sel, mode))
  }

  const onJumpSelect = (value: string) => {
    if (value === 'global') {
      setSelection(null)
      return
    }
    if (value === 'header') {
      setSelection({ kind: 'header' })
      return
    }
    if (value === 'credits') {
      setEditMode('text')
      setSelection({ kind: 'credits' })
      return
    }
    if (value.startsWith('slot-')) {
      const index = Number(value.slice(5))
      if (Number.isFinite(index) && layout.slots[index]) {
        if (editMode === 'focus') setSelection({ kind: 'focus', index })
        else if (editMode === 'text') setSelection({ kind: 'slot', index })
        else setSelection({ kind: 'slot', index })
      }
    }
  }

  const patchHeader = (partial: Partial<HeaderRegion>) => {
    patchLayout({ header: { ...layout.header, ...partial } })
  }

  const onHeaderStyleChange = (styleId: HeaderStyleId) => {
    const defaults = defaultHeaderRegion(styleId, POSTER_W)
    patchLayout({
      headerStyleId: styleId,
      recommendedHeaderStyleId: styleId,
      header: { ...defaults },
      headerTexts: defaultHeaderTexts(defaults, styleId, POSTER_W),
      creditsText: defaultCreditsText(POSTER_W, POSTER_H, styleId),
      textCoordsRelative: true,
    })
    setSelection({ kind: 'header' })
  }

  const onPreviewBg = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void saveUserImage(file, {
      maxEdge: 1920,
      quality: 0.84,
      prefix: 'preview-bg',
      gameCode,
    })
      .then((url) => patchLayout({ backgroundImageDataUrl: url }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    e.target.value = ''
  }

  const onHeaderImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void saveUserImage(file, {
      maxEdge: 1920,
      quality: 0.9,
      mime: 'image/png',
      prefix: 'header',
      gameCode,
    })
      .then((url) => patchLayout({ headerImageUrl: url }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    e.target.value = ''
  }

  const onImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void importLayoutJsonFile(file)
      .then((imported) => {
        setLayout(ensureLayoutTexts(imported))
        setSelection(null)
        setError('')
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
    e.target.value = ''
  }

  const saveToLibrary = () => {
    void upsertLayoutInLibrary(gameCode, layout).then((list) => {
      setLibrary(list)
      setError('')
    })
  }

  const deleteFromLibrary = (id: string) => {
    void removeLayoutFromLibrary(gameCode, id).then(setLibrary)
  }

  const applyDrag = useCallback(
    (clientX: number, clientY: number, state: DragState) => {
      const dx = (clientX - state.startX) / scale
      const dy = (clientY - state.startY) / scale
      let nextRect = applyRectDrag(state.orig, state.mode, dx, dy)
      const target = state.target

      if (snapGuidesEnabled && target.kind !== 'focus') {
        const ctx = buildSnapContext(layoutRef.current, target)
        const snapped = applySnapGuides(nextRect, state.mode, ctx)
        nextRect = snapped.rect
        setSnapGuides(snapped.guides)
      } else {
        setSnapGuides([])
      }

      setLayout((l) => {
        const updatedAt = new Date().toISOString()
        if (target.kind === 'header') {
          return { ...l, updatedAt, header: clampHeader({ ...l.header, ...nextRect }) }
        }
        if (target.kind === 'slot') {
          return {
            ...l,
            updatedAt,
            slots: l.slots.map((s, i) =>
              i === target.index ? clampSlot({ ...s, ...nextRect }) : s,
            ),
          }
        }
        if (target.kind === 'credits' && l.creditsText) {
          return {
            ...l,
            updatedAt,
            creditsText: clampTextBox({ ...l.creditsText, ...nextRect }),
          }
        }
        if (target.kind === 'header-text' && l.headerTexts?.[target.key]) {
          const box = clampTextBox({ ...l.headerTexts[target.key]!, ...nextRect })
          return {
            ...l,
            updatedAt,
            headerTexts: { ...l.headerTexts, [target.key]: box },
          }
        }
        if (target.kind === 'header-extra' && l.headerTexts?.extras) {
          const extras = l.headerTexts.extras.map((box) =>
            box.id === target.id ? clampTextBox({ ...box, ...nextRect }) : box,
          )
          return {
            ...l,
            updatedAt,
            headerTexts: { ...l.headerTexts, extras },
          }
        }
        if (target.kind === 'header-image' && l.headerTexts?.[target.key]) {
          const box = clampImageBox({ ...l.headerTexts[target.key]!, ...nextRect })
          return {
            ...l,
            updatedAt,
            headerTexts: { ...l.headerTexts, [target.key]: box },
          }
        }
        if (target.kind === 'slot-text') {
          const slot = l.slots[target.index]
          const tl = slot.textLayout ?? defaultSlotTextLayout(slot, l.theme ?? 'default')
          const box = clampTextBox({ ...tl[target.key]!, ...nextRect })
          return {
            ...l,
            updatedAt,
            slots: l.slots.map((s, i) =>
              i === target.index
                ? { ...s, textLayout: { ...tl, [target.key]: box } }
                : s,
            ),
          }
        }
        if (target.kind === 'slot-extra') {
          const slot = l.slots[target.index]
          const tl = slot.textLayout ?? defaultSlotTextLayout(slot, l.theme ?? 'default')
          const extras = (tl.extras ?? []).map((box) =>
            box.id === target.id ? clampTextBox({ ...box, ...nextRect }) : box,
          )
          return {
            ...l,
            updatedAt,
            slots: l.slots.map((s, i) =>
              i === target.index ? { ...s, textLayout: { ...tl, extras } } : s,
            ),
          }
        }
        return l
      })
    },
    [scale, snapGuidesEnabled],
  )

  const onSnapGuidesToggle = (enabled: boolean) => {
    setSnapGuidesEnabled(enabled)
    writeSnapGuidesEnabled(enabled)
    if (!enabled) setSnapGuides([])
  }

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => applyDrag(e.clientX, e.clientY, drag)
    const onUp = () => {
      setDrag(null)
      setSnapGuides([])
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, applyDrag])

  useEffect(() => {
    if (!focusDrag) return
    const onMove = (e: PointerEvent) => applyFocusDrag(e.clientX, e.clientY, focusDrag)
    const onUp = () => setFocusDrag(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [focusDrag, applyFocusDrag])

  const onFocusAreaPointerDown = (
    index: number,
    artRect: { x: number; y: number; w: number; h: number },
    e: ReactPointerEvent,
  ) => {
    e.stopPropagation()
    setSelection({ kind: 'focus', index })
    const state = { index, artRect }
    setFocusDrag(state)
    applyFocusDrag(e.clientX, e.clientY, state)
  }

  const onRectPointerDown = (target: EditorTarget, rect: { x: number; y: number; w: number; h: number }, e: ReactPointerEvent) => {
    e.stopPropagation()
    setSelection(target)
    const stageRect = stageRef.current?.getBoundingClientRect()
    if (!stageRect) return
    const sx = e.clientX - stageRect.left
    const sy = e.clientY - stageRect.top
    const mode = hitTestHandleRect(sx, sy, rect, scale) ?? 'move'
    setDrag({
      target,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    })
  }

  /** 父框内文字/Logo：拖拽时用画布坐标命中，存储相对父框坐标 */
  const onNestedRectPointerDown = (
    target: EditorTarget,
    parent: { x: number; y: number },
    rect: { x: number; y: number; w: number; h: number },
    e: ReactPointerEvent,
  ) => {
    e.stopPropagation()
    setSelection(target)
    const stageRect = stageRef.current?.getBoundingClientRect()
    if (!stageRect) return
    const sx = e.clientX - stageRect.left
    const sy = e.clientY - stageRect.top
    const absRect = { x: parent.x + rect.x, y: parent.y + rect.y, w: rect.w, h: rect.h }
    const mode = hitTestHandleRect(sx, sy, absRect, scale) ?? 'move'
    setDrag({
      target,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    })
  }

  const onHeaderPointerDown = (e: ReactPointerEvent) => {
    onRectPointerDown({ kind: 'header' }, layout.header, e)
  }

  const onSlotPointerDown = (index: number, e: ReactPointerEvent) => {
    onRectPointerDown({ kind: 'slot', index }, layout.slots[index], e)
  }

  const slotColors = useMemo(
    () =>
      layout.slots.map((s) =>
        resolveBoxAccent(
          s.playerIndex + 1,
          previewDoc as Parameters<typeof resolveBoxAccent>[1],
          s.boxStyle ?? layout.defaultBoxStyle,
          'main',
        ),
      ),
    [layout.slots, layout.defaultBoxStyle, previewDoc],
  )

  const previewBoxText = (
    box: import('../types').TextBoxLayout,
    ctx: { scope: 'header' | 'slot'; builtInKey?: HeaderTextKey | SlotTextKey; place?: number },
  ) =>
    resolveEditorTextBoxPreview(box, {
      ...ctx,
      bundle: previewSampleEnabled ? sampleBundle : null,
      charNames: sampleCharNames,
    })

  const selectionTitle = (() => {
    if (!selection) return '全局设置'
    if (selection.kind === 'header') return '标题栏面板'
    if (selection.kind === 'credits') return '页脚素材来源'
    if (selection.kind === 'header-text') return `标题文字 · ${HEADER_TEXT_LABELS[selection.key]}`
    if (selection.kind === 'header-extra') {
      const box = layout.headerTexts?.extras?.find((b) => b.id === selection.id)
      return `标题文字 · ${textBoxEditorLabel(box ?? { label: '自定义' } as import('../types').TextBoxLayout, '自定义')}`
    }
    if (selection.kind === 'header-image') return `Logo · ${HEADER_IMAGE_LABELS[selection.key]}`
    if (selection.kind === 'slot') {
      const s = layout.slots[selection.index]
      return s ? `选手框 · ${rankLabel(s.playerIndex + 1)}` : '选手框'
    }
    if (selection.kind === 'slot-text') {
      return `选手文字 · ${SLOT_TEXT_LABELS[selection.key]}`
    }
    if (selection.kind === 'slot-extra') {
      const slot = layout.slots[selection.index]
      const box = slot?.textLayout?.extras?.find((b) => b.id === selection.id)
      return `选手文字 · ${textBoxEditorLabel(box ?? { label: '自定义' } as import('../types').TextBoxLayout, '自定义')}`
    }
    if (selection.kind === 'focus') {
      const s = layout.slots[selection.index]
      return s ? `立绘焦点 · ${rankLabel(s.playerIndex + 1)}` : '立绘焦点'
    }
    return '布局默认'
  })()

  const selectionHint = (() => {
    if (editMode === 'focus') {
      if (!selection) return '焦点模式：点击选手框内立绘区域，拖拽「焦点」标记摆放构图中心'
      if (selection.kind === 'focus') return '拖拽焦点标记，或在立绘区域内点击/拖动调整构图'
      return ''
    }
    if (editMode === 'boxes') {
      if (!selection) return '框体模式：拖拽标题栏或选手框时，框内文字会一起移动'
      if (selection.kind === 'header') return '拖拽标题栏时，栏内文字与 Logo 会一起移动'
      if (selection.kind === 'slot') return '拖拽选手框时，框内文字会一起移动'
      return ''
    }
    if (!selection) return '文字模式：点击预览中的文字或 Logo 框进行编辑（相对父框定位）'
    if (selection.kind === 'header-text' || selection.kind === 'header-extra' || selection.kind === 'header-image')
      return '拖拽移动，右侧调整字号与颜色'
    if (selection.kind === 'slot-text' || selection.kind === 'slot-extra')
      return '拖拽移动该文字框（相对选手框）'
    if (selection.kind === 'credits') return '页脚素材来源文字（画布绝对坐标）'
    if (selection.kind === 'header') return '切换到「文字」模式可单独微调栏内文字'
    if (selection.kind === 'slot') return '切换到「文字」模式可单独微调框内文字'
    return ''
  })()

  return (
    <div className="layout-editor-overlay" role="dialog" aria-modal="true" aria-label="布局编辑器">
      <header className="layout-editor-top">
        <div className="layout-editor-top-title">
          <p className="eyebrow">Layout Editor</p>
          <h2>布局编辑器</h2>
          <p className="layout-editor-doc-name">{layout.name || '未命名布局'}</p>
        </div>
        <div className="layout-editor-top-actions">
          <button type="button" className="ghost" onClick={() => exportLayoutJson(layout)}>
            导出
          </button>
          <label className="ghost file-label">
            导入
            <input type="file" accept=".json,application/json" onChange={onImportFile} hidden />
          </label>
          <button type="button" className="ghost" onClick={saveToLibrary}>
            保存到库
          </button>
          <span className="layout-editor-top-divider" aria-hidden="true" />
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
          <button type="button" className="primary" onClick={() => onApply(layout)}>
            应用到海报
          </button>
        </div>
      </header>

      <div className="layout-editor-main">
        <div className="layout-editor-stage-wrap">
          <div className="layout-editor-stage-toolbar">
            <div className="layout-editor-mode-toggle" role="tablist" aria-label="编辑模式">
              <button
                type="button"
                role="tab"
                aria-selected={editMode === 'boxes'}
                className={editMode === 'boxes' ? 'active' : ''}
                onClick={() => switchEditMode('boxes')}
              >
                框体
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editMode === 'text'}
                className={editMode === 'text' ? 'active' : ''}
                onClick={() => switchEditMode('text')}
              >
                文字
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={editMode === 'focus'}
                className={editMode === 'focus' ? 'active' : ''}
                onClick={() => switchEditMode('focus')}
              >
                焦点
              </button>
            </div>
            <select
              className="layout-template-select"
              value={layout.basedOn ?? 'blank'}
              onChange={(e) => {
                const v = e.target.value
                loadTemplate(v === 'blank' ? 'blank' : (v as BuiltInLayoutId))
              }}
            >
              {LAYOUT_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  模板：{t.name}
                </option>
              ))}
              <option value="blank">模板：空白画布</option>
            </select>
            <span className="toolbar-sep">·</span>
            <label className="layout-snap-toggle">
              <input
                type="checkbox"
                checked={previewSampleEnabled}
                onChange={(e) => onPreviewSampleToggle(e.target.checked)}
              />
              示例内容
            </label>
            <span className="toolbar-sep">·</span>
            <label className="layout-snap-toggle">
              <input
                type="checkbox"
                checked={snapGuidesEnabled}
                onChange={(e) => onSnapGuidesToggle(e.target.checked)}
              />
              对齐线
            </label>
            <span className="toolbar-sep">·</span>
            <label className="layout-stage-zoom">
              预览缩放
              <input
                type="range"
                min={50}
                max={200}
                step={5}
                value={stageZoom}
                onChange={(e) => onStageZoomChange(Number(e.target.value))}
                aria-valuetext={`${stageZoom}%`}
              />
              <span className="layout-stage-zoom-value">{stageZoom}%</span>
            </label>
            <button
              type="button"
              className="ghost layout-stage-zoom-reset"
              onClick={() => onStageZoomChange(100)}
              title="重置为 100%"
            >
              重置
            </button>
            <span className="toolbar-sep">·</span>
            <span>{editMode === 'boxes' ? '拖拽框体' : editMode === 'text' ? '拖拽文字' : '拖拽焦点'}</span>
            <span className="toolbar-sep">·</span>
            <span>{stageWidth}px</span>
          </div>
          <div
            ref={stageRef}
            className={`layout-editor-stage${editMode === 'text' ? ' text-mode' : ''}${editMode === 'focus' ? ' focus-mode' : ''}${previewSampleEnabled ? ' sample-on' : ''}`}
            style={{ width: stageWidth, height: stageHeight }}
            onPointerDown={() => setSelection(null)}
          >
            {(layout.backgroundImageDataUrl ?? layout.previewBackgroundDataUrl) ? (
              <img
                className="layout-editor-bg"
                src={layout.backgroundImageDataUrl ?? layout.previewBackgroundDataUrl}
                alt=""
                draggable={false}
              />
            ) : (
              <div
                className="layout-editor-bg solid"
                style={{ background: layout.background ?? '#0a0b10' }}
              />
            )}
            {snapGuidesEnabled && snapGuides.length > 0 ? (
              <div className="layout-snap-guides" aria-hidden="true">
                {snapGuides.map((guide, i) =>
                  guide.orientation === 'vertical' ? (
                    <div
                      key={`v-${i}`}
                      className="layout-snap-guide vertical"
                      style={{
                        left: guide.position * scale,
                        top: guide.start * scale,
                        height: Math.max(1, (guide.end - guide.start) * scale),
                      }}
                    />
                  ) : (
                    <div
                      key={`h-${i}`}
                      className="layout-snap-guide horizontal"
                      style={{
                        top: guide.position * scale,
                        left: guide.start * scale,
                        width: Math.max(1, (guide.end - guide.start) * scale),
                      }}
                    />
                  ),
                )}
              </div>
            ) : null}
            <div
              className={`layout-editor-header-region${selection?.kind === 'header' && editMode === 'boxes' ? ' active' : ''}${editMode === 'text' ? ' ghost-box' : ''}`}
              style={{
                left: layout.header.x * scale,
                top: layout.header.y * scale,
                width: layout.header.w * scale,
                height: layout.header.h * scale,
                backgroundColor: editMode === 'text'
                  ? 'rgba(0,0,0,0.06)'
                  : colorWithOpacity(
                      layout.header.backgroundColor ?? DEFAULT_HEADER_BG,
                      layout.header.backgroundOpacity ?? 0.55,
                    ),
                borderRadius: (layout.header.borderRadius ?? 0) * scale,
                border:
                  editMode === 'text'
                    ? '1px dashed rgba(255,255,255,0.18)'
                    : layout.header.borderWidth && layout.header.borderWidth > 0
                      ? `${Math.max(1, layout.header.borderWidth * scale)}px solid ${layout.header.borderColor ?? editorAccent}`
                      : `2px solid ${selection?.kind === 'header' ? editorAccent : 'rgba(245, 197, 24, 0.55)'}`,
              }}
              onPointerDown={editMode === 'boxes' ? onHeaderPointerDown : undefined}
            >
              {layout.headerImageUrl ? (
                <img src={layout.headerImageUrl} alt="" className="layout-editor-header-bg" draggable={false} />
              ) : null}
              {layout.header.accentBarHeight && layout.header.accentBarHeight > 0 ? (
                <div
                  className="layout-editor-header-accent-bar"
                  style={{
                    height: Math.max(1, layout.header.accentBarHeight * scale),
                    backgroundColor: editorAccent,
                  }}
                />
              ) : null}
              <span className="layout-editor-header-label">
                标题栏 · {HEADER_STYLE_LIST.find((h) => h.id === activeHeaderStyle)?.name}
              </span>
              <span className="layout-slot-size header-size">
                {Math.round(layout.header.w)}×{Math.round(layout.header.h)}
              </span>
              {(Object.keys(HEADER_TEXT_LABELS) as HeaderTextKey[]).map((key) => {
                const box = layout.headerTexts?.[key]
                if (!box || box.visible === false) return null
                const target: EditorTarget = { kind: 'header-text', key }
                const active = isSameSelection(selection, target)
                const textInteractive = editMode === 'text'
                const preview = previewBoxText(box, { scope: 'header', builtInKey: key })
                const showText = textInteractive || (previewSampleEnabled && !textInteractive)
                if (!showText) return null
                return (
                  <div
                    key={`ht-${key}`}
                    className={`layout-text-box${active ? ' active' : ''}${!textInteractive ? ' sample-text' : ''}`}
                    style={{
                      left: box.x * scale,
                      top: box.y * scale,
                      width: box.w * scale,
                      height: box.h * scale,
                      fontSize: Math.min(box.h * scale * 0.7, box.fontSize * scale),
                      color: box.color ?? '#f7f3ea',
                      textAlign: box.align ?? 'left',
                      pointerEvents: textInteractive ? 'auto' : 'none',
                      opacity: textInteractive ? (active ? 1 : 0.92) : 0.95,
                    }}
                    onPointerDown={
                      textInteractive
                        ? (e) => onNestedRectPointerDown(target, layout.header, box, e)
                        : undefined
                    }
                  >
                    <span className="layout-text-box-content">{preview}</span>
                  </div>
                )
              })}
              {(layout.headerTexts?.extras ?? []).map((box) => {
                if (!box.id || box.visible === false) return null
                const target: EditorTarget = { kind: 'header-extra', id: box.id }
                const active = isSameSelection(selection, target)
                const textInteractive = editMode === 'text'
                const preview = previewBoxText(box, { scope: 'header' })
                const showText = textInteractive || (previewSampleEnabled && !textInteractive)
                if (!showText) return null
                return (
                  <div
                    key={`hex-${box.id}`}
                    className={`layout-text-box${active ? ' active' : ''}${!textInteractive ? ' sample-text' : ''}`}
                    style={{
                      left: box.x * scale,
                      top: box.y * scale,
                      width: box.w * scale,
                      height: box.h * scale,
                      fontSize: Math.min(box.h * scale * 0.7, box.fontSize * scale),
                      color: box.color ?? '#f7f3ea',
                      textAlign: box.align ?? 'left',
                      pointerEvents: textInteractive ? 'auto' : 'none',
                      opacity: textInteractive ? (active ? 1 : 0.92) : 0.95,
                    }}
                    onPointerDown={
                      textInteractive
                        ? (e) => onNestedRectPointerDown(target, layout.header, box, e)
                        : undefined
                    }
                  >
                    <span className="layout-text-box-content">{preview}</span>
                  </div>
                )
              })}
              {(Object.keys(HEADER_IMAGE_LABELS) as HeaderImageKey[]).map((key) => {
                const box = layout.headerTexts?.[key]
                if (!box || box.visible === false) return null
                const target: EditorTarget = { kind: 'header-image', key }
                const active = isSameSelection(selection, target)
                const textInteractive = editMode === 'text'
                const logoImg =
                  previewSampleEnabled &&
                  (key === 'gameLogo' ? sampleLogos.gameLogo : sampleLogos.customLogo)
                const showSampleLogo = Boolean(logoImg)
                if (!textInteractive && !showSampleLogo) return null
                return (
                  <div
                    key={`hi-${key}`}
                    className={`layout-image-box${active ? ' active' : ''}${showSampleLogo ? ' sample-logo' : ''}`}
                    style={{
                      left: box.x * scale,
                      top: box.y * scale,
                      width: box.w * scale,
                      height: box.h * scale,
                      pointerEvents: textInteractive ? 'auto' : 'none',
                      opacity: textInteractive ? (active ? 1 : 0.92) : 1,
                    }}
                    onPointerDown={
                      textInteractive
                        ? (e) => onNestedRectPointerDown(target, layout.header, box, e)
                        : undefined
                    }
                  >
                    {logoImg ? (
                      <img
                        className="layout-header-logo-preview"
                        src={logoImg.src}
                        alt=""
                        draggable={false}
                      />
                    ) : (
                      <span>{HEADER_IMAGE_LABELS[key]}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {layout.slots.map((slot, i) => {
              const placement = slot.playerIndex + 1
              const active = selection?.kind === 'slot' && selection.index === i && editMode === 'boxes'
              const focusActive = selection?.kind === 'focus' && selection.index === i
              const textMode = editMode === 'text'
              const focusMode = editMode === 'focus'
              const ghostChrome = textMode || focusMode
              const samplePlayer =
                previewSampleEnabled && sampleBundle ? sampleBundle.players[placement - 1] : null
              const sampleExtraCount = samplePlayer
                ? Math.max(0, Math.min(previewExtraCount, samplePlayer.characters.length - 1))
                : previewExtraCount
              const artRect = computeSlotArtRect(slot, placement, {
                theme: layout.theme,
                extraCharStyleId,
                playerIdStyleId,
                extraCount: previewSampleEnabled ? sampleExtraCount : previewExtraCount,
                hasRoster: previewSampleEnabled,
                extraCharLayout: layout.recommendedExtraCharLayout,
                playerIdLayout: layout.recommendedPlayerIdLayout,
              })
              const relArt = artRectRelativeToSlot(slot, artRect)
              const boxStyle = normalizeBoxStyle(slot.boxStyle ?? layout.defaultBoxStyle)
              const borderW = resolveBorderWidth(boxStyle, placement, 'main')
              const borderOp = resolveBorderOpacity(boxStyle, 'main')
              const accentColor = slotColors[i]
              const fill = resolveBoxFill(placement, previewDoc as Top8Doc, boxStyle, boxStyle.fillOpacity ?? 0.35)
              const extraBoxes = computeExtraCharBoxes(slot, {
                place: placement,
                extraCharStyleId,
                playerIdStyleId,
                extraCount: previewSampleEnabled ? sampleExtraCount : previewExtraCount,
                extraCharLayout: layout.recommendedExtraCharLayout,
                playerIdLayout: layout.recommendedPlayerIdLayout,
              })
              const extraAccent = resolveBoxAccent(
                placement,
                previewDoc as Top8Doc,
                boxStyle,
                'extra',
              )
              const extraFill = resolveExtraBoxFill(
                placement,
                previewDoc as Top8Doc,
                boxStyle,
                boxStyle.extraFillOpacity ?? 0.5,
              )
              const extraBorderW = resolveBorderWidth(boxStyle, placement, 'extra')
              const extraBorderOp = resolveBorderOpacity(boxStyle, 'extra')
              const extraRadius = (boxStyle.extraBorderRadius ?? 8) * scale
              const showArt = previewSampleEnabled || focusMode

              return (
                <Fragment key={i}>
                  <div
                    className={`layout-slot${active ? ' active' : ''}${focusActive ? ' focus-active' : ''}${ghostChrome ? ' ghost-box' : ''}`}
                    style={{
                      left: slot.x * scale,
                      top: slot.y * scale,
                      width: slot.w * scale,
                      height: slot.h * scale,
                      borderColor: ghostChrome
                        ? focusActive
                          ? colorWithOpacity(accentColor, 0.75)
                          : 'rgba(255,255,255,0.14)'
                        : colorWithOpacity(accentColor, borderOp),
                      borderWidth: Math.max(1, borderW * scale),
                      borderStyle: ghostChrome ? 'dashed' : 'solid',
                      background: ghostChrome ? 'rgba(0,0,0,0.06)' : fill,
                      borderRadius: slot.radius * scale,
                      ['--slot-accent' as string]: accentColor,
                    }}
                    onPointerDown={
                      editMode === 'boxes'
                        ? (e) => onSlotPointerDown(i, e)
                        : focusMode
                          ? (e) => onFocusAreaPointerDown(i, artRect, e)
                          : undefined
                    }
                  >
                    {showArt ? (
                      <LayoutEditorSlotArt
                        slot={slot}
                        artRect={artRect}
                        relArt={relArt}
                        scale={scale}
                        img={previewSampleEnabled ? sampleImages.get(`${i}:0`) : null}
                        pick={samplePlayer?.characters[0] ?? null}
                        pack={previewAssets?.pack ?? null}
                        showPlaceholder
                        dimmed={!focusMode && previewSampleEnabled}
                        focusMode={focusMode}
                        focusActive={focusActive}
                        onFocusPointerDown={(e) => onFocusAreaPointerDown(i, artRect, e)}
                      />
                    ) : null}
                    {!focusMode ? (
                      <>
                        <span className="layout-slot-label">{rankLabel(placement)}</span>
                        <span className="layout-slot-size">
                          {Math.round(slot.w)}×{Math.round(slot.h)}
                        </span>
                      </>
                    ) : null}
                    {textMode || (previewSampleEnabled && !focusMode) ? (
                      <>
                        {(Object.keys(SLOT_TEXT_LABELS) as SlotTextKey[]).map((key) => {
                          const tl =
                            slot.textLayout ??
                            defaultSlotTextLayout(slot, layout.theme ?? 'default')
                          const box = tl[key]
                          if (!box || box.visible === false) return null
                          const target: EditorTarget = { kind: 'slot-text', index: i, key }
                          const textActive = isSameSelection(selection, target)
                          const textInteractive = editMode === 'text'
                          const preview = previewBoxText(box, {
                            scope: 'slot',
                            builtInKey: key,
                            place: placement,
                          })
                          const showText = textInteractive || (previewSampleEnabled && !textInteractive)
                          if (!showText) return null
                          return (
                            <div
                              key={`st-${key}`}
                              className={`layout-text-box slot-text${textActive ? ' active' : ''}${!textInteractive ? ' sample-text' : ''}`}
                              style={{
                                left: box.x * scale,
                                top: box.y * scale,
                                width: box.w * scale,
                                height: box.h * scale,
                                fontSize: Math.min(box.h * scale * 0.75, box.fontSize * scale),
                                color: box.color ?? '#f7f3ea',
                                textAlign: box.align ?? 'left',
                                pointerEvents: textInteractive ? 'auto' : 'none',
                                opacity: textInteractive ? (textActive ? 1 : 0.92) : 0.95,
                              }}
                              onPointerDown={
                                textInteractive
                                  ? (e) => onNestedRectPointerDown(target, slot, box, e)
                                  : undefined
                              }
                            >
                              <span className="layout-text-box-content">{preview}</span>
                            </div>
                          )
                        })}
                        {(slot.textLayout?.extras ?? []).map((box) => {
                          if (!box.id || box.visible === false) return null
                          const target: EditorTarget = { kind: 'slot-extra', index: i, id: box.id }
                          const textActive = isSameSelection(selection, target)
                          const textInteractive = editMode === 'text'
                          const preview = previewBoxText(box, { scope: 'slot', place: placement })
                          const showText = textInteractive || (previewSampleEnabled && !textInteractive)
                          if (!showText) return null
                          return (
                            <div
                              key={`sex-${box.id}`}
                              className={`layout-text-box slot-text${textActive ? ' active' : ''}${!textInteractive ? ' sample-text' : ''}`}
                              style={{
                                left: box.x * scale,
                                top: box.y * scale,
                                width: box.w * scale,
                                height: box.h * scale,
                                fontSize: Math.min(box.h * scale * 0.75, box.fontSize * scale),
                                color: box.color ?? '#f7f3ea',
                                textAlign: box.align ?? 'left',
                                pointerEvents: textInteractive ? 'auto' : 'none',
                                opacity: textInteractive ? (textActive ? 1 : 0.92) : 0.95,
                              }}
                              onPointerDown={
                                textInteractive
                                  ? (e) => onNestedRectPointerDown(target, slot, box, e)
                                  : undefined
                              }
                            >
                              <span className="layout-text-box-content">{preview}</span>
                            </div>
                          )
                        })}
                      </>
                    ) : null}
                  </div>
                  {extraBoxes.map((box, extraIdx) => (
                    <div
                      key={`${i}-${box.label}`}
                      className={`layout-extra-slot${ghostChrome ? ' text-mode-dim' : ''}`}
                      style={{
                        left: box.x * scale,
                        top: box.y * scale,
                        width: box.w * scale,
                        height: box.h * scale,
                        borderColor: ghostChrome
                          ? 'rgba(255,255,255,0.08)'
                          : colorWithOpacity(extraAccent, extraBorderOp),
                        borderWidth: Math.max(1, extraBorderW * scale),
                        background: ghostChrome ? 'transparent' : extraFill,
                        borderRadius: extraRadius,
                        overflow: 'hidden',
                      }}
                      title={`${rankLabel(placement)} ${box.label}`}
                    >
                      {previewSampleEnabled && sampleImages.get(`${i}:${extraIdx + 1}`) ? (
                        <img
                          className="layout-extra-slot-art"
                          src={sampleImages.get(`${i}:${extraIdx + 1}`)!.src}
                          alt=""
                          draggable={false}
                        />
                      ) : (
                        <span>{box.label}</span>
                      )}
                    </div>
                  ))}
                </Fragment>
              )
            })}
            {editMode === 'text' && layout.creditsText && layout.creditsText.visible !== false ? (
              <div
                className={`layout-text-box credits${isSameSelection(selection, { kind: 'credits' }) ? ' active' : ''}`}
                style={{
                  left: layout.creditsText.x * scale,
                  top: layout.creditsText.y * scale,
                  width: layout.creditsText.w * scale,
                  height: layout.creditsText.h * scale,
                  fontSize: Math.min(
                    layout.creditsText.h * scale * 0.8,
                    layout.creditsText.fontSize * scale,
                  ),
                  color: layout.creditsText.color ?? 'rgba(247,243,234,0.45)',
                }}
                onPointerDown={(e) => onRectPointerDown({ kind: 'credits' }, layout.creditsText!, e)}
              >
                <span className="layout-text-box-content">{resolveCreditsText()}</span>
                <span className="layout-text-box-label">素材来源</span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="layout-editor-props">
          <div className="layout-editor-props-head">
            <h3>{selectionTitle}</h3>
            <p className="hint">{selectionHint}</p>
            <label className="le-jump-label">
              跳转到
              <select
                className="le-jump-select"
                value={selectionJumpValue(selection)}
                onChange={(e) => onJumpSelect(e.target.value)}
              >
                <option value="global">全局设置</option>
                <option value="header">标题栏</option>
                {layout.slots.map((slot, i) => (
                  <option key={i} value={`slot-${i}`}>
                    {rankLabel(slot.playerIndex + 1)} 选手框
                  </option>
                ))}
                {editMode === 'text' ? <option value="credits">页脚文字</option> : null}
              </select>
            </label>
          </div>

          <div className="layout-editor-props-body">
            {selection?.kind === 'header-text' && layout.headerTexts?.[selection.key] ? (
              <TextBoxPropsEditor
                label={HEADER_TEXT_LABELS[selection.key]}
                value={{
                  ...layout.headerTexts[selection.key]!,
                  contentSource:
                    layout.headerTexts[selection.key]!.contentSource ?? selection.key,
                }}
                contentSources={HEADER_CONTENT_SOURCE_OPTIONS}
                onChange={(box) =>
                  patchLayout({
                    headerTexts: { ...layout.headerTexts, [selection.key]: box },
                  })
                }
                onDelete={() => {
                  const ht = { ...layout.headerTexts }
                  delete ht[selection.key]
                  patchLayout({ headerTexts: ht })
                  setSelection({ kind: 'header' })
                }}
              />
            ) : selection?.kind === 'header-extra' ? (
              (() => {
                const box = layout.headerTexts?.extras?.find((b) => b.id === selection.id)
                if (!box) return null
                return (
                  <TextBoxPropsEditor
                    label={textBoxEditorLabel(box, '自定义标题文字')}
                    value={box}
                    contentSources={HEADER_CONTENT_SOURCE_OPTIONS}
                    onChange={(next) => {
                      const ht =
                        layout.headerTexts ??
                        defaultHeaderTexts(layout.header, activeHeaderStyle, layout.width)
                      patchLayout({
                        headerTexts: {
                          ...ht,
                          extras: (ht.extras ?? []).map((b) => (b.id === selection.id ? next : b)),
                        },
                      })
                    }}
                    onDelete={() => {
                      const ht =
                        layout.headerTexts ??
                        defaultHeaderTexts(layout.header, activeHeaderStyle, layout.width)
                      patchLayout({
                        headerTexts: {
                          ...ht,
                          extras: (ht.extras ?? []).filter((b) => b.id !== selection.id),
                        },
                      })
                      setSelection({ kind: 'header' })
                    }}
                  />
                )
              })()
            ) : selection?.kind === 'header-image' && layout.headerTexts?.[selection.key] ? (
              <ImageBoxPropsEditor
                label={HEADER_IMAGE_LABELS[selection.key]}
                value={layout.headerTexts[selection.key]!}
                onChange={(box) =>
                  patchLayout({
                    headerTexts: { ...layout.headerTexts, [selection.key]: box },
                  })
                }
              />
            ) : selection?.kind === 'credits' && layout.creditsText ? (
              <TextBoxPropsEditor
                label="素材来源"
                value={layout.creditsText}
                onChange={(creditsText) => patchLayout({ creditsText })}
              />
            ) : selection?.kind === 'slot-text' &&
              layout.slots[selection.index]?.textLayout?.[selection.key] ? (
              <TextBoxPropsEditor
                label={SLOT_TEXT_LABELS[selection.key]}
                value={{
                  ...layout.slots[selection.index].textLayout![selection.key]!,
                  contentSource:
                    layout.slots[selection.index].textLayout![selection.key]!.contentSource ??
                    selection.key,
                }}
                contentSources={SLOT_CONTENT_SOURCE_OPTIONS}
                onChange={(box) => {
                  const idx = selection.index
                  const slot = layout.slots[idx]
                  const tl = slot.textLayout ?? defaultSlotTextLayout(slot, layout.theme ?? 'default')
                  patchSlot(idx, { textLayout: { ...tl, [selection.key]: box } })
                }}
                onDelete={() => {
                  const idx = selection.index
                  const slot = layout.slots[idx]
                  const tl = { ...(slot.textLayout ?? defaultSlotTextLayout(slot, layout.theme ?? 'default')) }
                  delete tl[selection.key]
                  patchSlot(idx, { textLayout: tl })
                  setSelection({ kind: 'slot', index: idx })
                }}
              />
            ) : selection?.kind === 'slot-extra' ? (
              (() => {
                const idx = selection.index
                const slot = layout.slots[idx]
                const box = slot?.textLayout?.extras?.find((b) => b.id === selection.id)
                if (!box) return null
                return (
                  <TextBoxPropsEditor
                    label={textBoxEditorLabel(box, '自定义选手文字')}
                    value={box}
                    contentSources={SLOT_CONTENT_SOURCE_OPTIONS}
                    onChange={(next) => {
                      const tl =
                        slot.textLayout ?? defaultSlotTextLayout(slot, layout.theme ?? 'default')
                      patchSlot(idx, {
                        textLayout: {
                          ...tl,
                          extras: (tl.extras ?? []).map((b) => (b.id === selection.id ? next : b)),
                        },
                      })
                    }}
                    onDelete={() => {
                      const tl =
                        slot.textLayout ?? defaultSlotTextLayout(slot, layout.theme ?? 'default')
                      patchSlot(idx, {
                        textLayout: {
                          ...tl,
                          extras: (tl.extras ?? []).filter((b) => b.id !== selection.id),
                        },
                      })
                      setSelection({ kind: 'slot', index: idx })
                    }}
                  />
                )
              })()
            ) : selection?.kind === 'header' ? (
              <>
                <LayoutEditorSection title="标题栏" defaultOpen>
                  <label>
                    样式
                    <select
                      value={activeHeaderStyle}
                      onChange={(e) => onHeaderStyleChange(e.target.value as HeaderStyleId)}
                    >
                      {HEADER_STYLE_LIST.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dim">
                    背景透明度 {Math.round((layout.header.backgroundOpacity ?? 0.55) * 100)}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round((layout.header.backgroundOpacity ?? 0.55) * 100)}
                      onChange={(e) =>
                        patchHeader({ backgroundOpacity: Number(e.target.value) / 100 })
                      }
                    />
                  </label>
                  <div className="row">
                    <label>
                      背景色
                      <input
                        type="color"
                        value={layout.header.backgroundColor ?? DEFAULT_HEADER_BG}
                        onChange={(e) => patchHeader({ backgroundColor: e.target.value })}
                      />
                    </label>
                    <label>
                      圆角
                      <input
                        type="number"
                        min={0}
                        max={48}
                        value={layout.header.borderRadius ?? 0}
                        onChange={(e) => patchHeader({ borderRadius: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <details className="le-details">
                    <summary>精确位置与外观</summary>
                    <div className="row">
                      <label>
                        X
                        <input
                          type="number"
                          value={Math.round(layout.header.x)}
                          onChange={(e) => patchHeader({ x: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Y
                        <input
                          type="number"
                          value={Math.round(layout.header.y)}
                          onChange={(e) => patchHeader({ y: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="row">
                      <label>
                        宽
                        <input
                          type="number"
                          value={Math.round(layout.header.w)}
                          onChange={(e) => patchHeader({ w: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        高
                        <input
                          type="number"
                          value={Math.round(layout.header.h)}
                          onChange={(e) => patchHeader({ h: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <label>
                      标题栏背景图
                      <input type="file" accept="image/*" onChange={onHeaderImage} />
                    </label>
                    {layout.headerImageUrl ? (
                      <button
                        type="button"
                        className="ghost tiny"
                        onClick={() => patchLayout({ headerImageUrl: '' })}
                      >
                        清除背景图
                      </button>
                    ) : null}
                  </details>
                </LayoutEditorSection>
                {editMode === 'text' ? (
                  <LayoutEditorSection title="标题文字框" defaultOpen={false}>
                    <p className="hint compact">
                      点击预览中的文字框编辑；可添加额外文字框，并选择自动获取或固定内容。
                    </p>
                    <button type="button" className="ghost" onClick={addHeaderTextBox}>
                      添加文字框
                    </button>
                  </LayoutEditorSection>
                ) : null}
              </>
            ) : selection?.kind === 'focus' && selectedSlot ? (
              <LayoutEditorSection
                title={`立绘焦点 · ${rankLabel(selectedSlot.playerIndex + 1)}`}
                defaultOpen
              >
                <p className="hint compact">
                  拖拽预览中的「焦点」标记，调整立绘构图中心（与最终海报一致）。
                </p>
                {!previewSampleEnabled ? (
                  <p className="hint compact">
                    建议开启工具栏「示例内容」，加载示例立绘后再微调焦点。
                  </p>
                ) : null}
                <label>
                  焦点 X
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(selectedSlot.focusX * 100)}
                    onChange={(e) =>
                      patchSlot(selectedSlotIndex, { focusX: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="sub-label">{selectedSlot.focusX.toFixed(3)}</span>
                </label>
                <label>
                  焦点 Y
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(selectedSlot.focusY * 100)}
                    onChange={(e) =>
                      patchSlot(selectedSlotIndex, { focusY: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="sub-label">{selectedSlot.focusY.toFixed(3)}</span>
                </label>
              </LayoutEditorSection>
            ) : selection?.kind === 'slot' && selectedSlot ? (
              <>
                <LayoutEditorSection title={`选手框 · ${rankLabel(selectedSlot.playerIndex + 1)}`} defaultOpen>
                  <label>
                    对应名次
                    <select
                      value={selectedSlot.playerIndex}
                      onChange={(e) =>
                        patchSlot(selectedSlotIndex, { playerIndex: Number(e.target.value) })
                      }
                    >
                      {Array.from({ length: 8 }, (_, i) => (
                        <option key={i} value={i}>
                          {rankLabel(i + 1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="row">
                    <label>
                      名字字号
                      <input
                        type="number"
                        value={selectedSlot.nameSize}
                        onChange={(e) => patchSlot(selectedSlotIndex, { nameSize: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      名次字号
                      <input
                        type="number"
                        value={selectedSlot.placeSize}
                        onChange={(e) => patchSlot(selectedSlotIndex, { placeSize: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <details className="le-details">
                    <summary>精确位置与立绘焦点</summary>
                    <div className="row">
                      <label>
                        X
                        <input
                          type="number"
                          value={Math.round(selectedSlot.x)}
                          onChange={(e) => patchSlot(selectedSlotIndex, { x: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Y
                        <input
                          type="number"
                          value={Math.round(selectedSlot.y)}
                          onChange={(e) => patchSlot(selectedSlotIndex, { y: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="row">
                      <label>
                        宽
                        <input
                          type="number"
                          value={Math.round(selectedSlot.w)}
                          onChange={(e) => patchSlot(selectedSlotIndex, { w: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        高
                        <input
                          type="number"
                          value={Math.round(selectedSlot.h)}
                          onChange={(e) => patchSlot(selectedSlotIndex, { h: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <div className="row">
                      <label>
                        焦点 X
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedSlot.focusX}
                          onChange={(e) => patchSlot(selectedSlotIndex, { focusX: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        焦点 Y
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedSlot.focusY}
                          onChange={(e) => patchSlot(selectedSlotIndex, { focusY: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <label>
                      圆角
                      <input
                        type="number"
                        value={selectedSlot.radius}
                        onChange={(e) => patchSlot(selectedSlotIndex, { radius: Number(e.target.value) })}
                      />
                    </label>
                  </details>
                </LayoutEditorSection>

                <LayoutEditorSection title="框体样式" defaultOpen={false}>
                  <BoxStyleEditor
                    label="本区域（覆盖全局）"
                    value={selectedSlot.boxStyle ?? layout.defaultBoxStyle}
                    onChange={(boxStyle) => patchSlot(selectedSlotIndex, { boxStyle })}
                    showExtra
                    gameCode={gameCode}
                    onError={setError}
                  />
                </LayoutEditorSection>
                {editMode === 'text' ? (
                  <LayoutEditorSection title="选手文字框" defaultOpen={false}>
                    <p className="hint compact">
                      可删除模板自带文字框，或添加新框并绑定自动字段/固定文字。
                    </p>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => addSlotTextBox(selectedSlotIndex)}
                    >
                      添加文字框
                    </button>
                  </LayoutEditorSection>
                ) : null}
              </>
            ) : (
              <>
                <div className="le-welcome">
                  <p><strong>1.</strong> 选模板，在「框体」模式拖放布局</p>
                  <p><strong>2.</strong> 「文字」模式调标题与选手名；「焦点」模式调整立绘构图</p>
                  <p><strong>3.</strong> 可开启「示例内容」预览真实文字与立绘</p>
                  <p><strong>4.</strong> 完成后点「应用到海报」</p>
                </div>

                <LayoutEditorSection title="布局信息" defaultOpen>
                  <label>
                    名称
                    <input value={layout.name} onChange={(e) => patchLayout({ name: e.target.value })} />
                  </label>
                  <label>
                    布局背景图
                    <input type="file" accept="image/*" onChange={onPreviewBg} />
                  </label>
                  <label>
                    背景底色
                    <input
                      type="color"
                      value={layout.background ?? '#0a0b10'}
                      onChange={(e) => patchLayout({ background: e.target.value })}
                    />
                  </label>
                  <label className="dim">
                    背景暗化 {Math.round((layout.backgroundDim ?? 0.45) * 100)}%
                    <input
                      type="range"
                      min={0}
                      max={80}
                      value={Math.round((layout.backgroundDim ?? 0.45) * 100)}
                      onChange={(e) =>
                        patchLayout({ backgroundDim: Number(e.target.value) / 100 })
                      }
                    />
                  </label>
                  {(layout.backgroundImageDataUrl ?? layout.previewBackgroundDataUrl) ? (
                    <button
                      type="button"
                      className="ghost tiny"
                      onClick={() => patchLayout({ backgroundImageDataUrl: '' })}
                    >
                      清除背景图
                    </button>
                  ) : null}
                  <p className="hint compact">
                    背景、副角色布局与选手 ID 样式会随布局保存；应用到海报后，主界面修改才会覆盖布局默认值。
                  </p>
                </LayoutEditorSection>

                {library.length > 0 ? (
                  <LayoutEditorSection title="我的布局" defaultOpen={false}>
                    <div className="library-list">
                      {library.map((item) => (
                        <div key={item.id} className="library-item">
                          <button type="button" className="ghost" onClick={() => loadFromLibrary(item.id)}>
                            {item.name}
                          </button>
                          <button
                            type="button"
                            className="ghost tiny danger"
                            title="删除"
                            onClick={() => deleteFromLibrary(item.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </LayoutEditorSection>
                ) : null}

                <LayoutEditorSection title="主题渲染参数" defaultOpen={false}>
                  <LayoutThemeConfigEditor
                    value={layout.recommendedThemeConfig}
                    theme={layout.theme}
                    onChange={(recommendedThemeConfig) =>
                      patchLayout({ recommendedThemeConfig: normalizeThemeConfig(recommendedThemeConfig) })
                    }
                  />
                </LayoutEditorSection>

                <LayoutEditorSection title="字体与默认框体" defaultOpen={false}>
                  <label>
                    默认强调色
                    <input
                      type="color"
                      value={layout.recommendedAccent ?? editorAccent}
                      onChange={(e) => patchLayout({ recommendedAccent: e.target.value })}
                    />
                  </label>
                  <FontPicker
                    label="标题字体"
                    value={layout.titleFontId ?? 'noto-sans'}
                    onChange={(titleFontId) => patchLayout({ titleFontId })}
                  />
                  <FontPicker
                    label="选手字体"
                    value={layout.playerFontId ?? 'noto-sans'}
                    onChange={(playerFontId) => patchLayout({ playerFontId })}
                  />
                  <FontPicker
                    label="名次字体"
                    value={layout.rankFontId ?? 'bebas'}
                    onChange={(rankFontId) => patchLayout({ rankFontId })}
                  />
                  <BoxStyleEditor
                    label="默认选手框"
                    value={layout.defaultBoxStyle}
                    onChange={(defaultBoxStyle) => patchLayout({ defaultBoxStyle })}
                    showExtra
                    gameCode={gameCode}
                    onError={setError}
                  />
                </LayoutEditorSection>

                <LayoutEditorSection title="预览辅助" defaultOpen={false}>
                  <label className="check inline-check">
                    <input
                      type="checkbox"
                      checked={previewSampleEnabled}
                      onChange={(e) => onPreviewSampleToggle(e.target.checked)}
                    />
                    示例文字与立绘（仅编辑器预览，不影响导出布局）
                  </label>
                  <label>预览素材库</label>
                  <button
                    type="button"
                    className="game-asset-picker-trigger compact"
                    onClick={() => setPreviewGamePickerOpen(true)}
                  >
                    <span className="game-asset-picker-thumb-wrap">
                      <img
                        className="game-asset-picker-thumb"
                        src={`/api/sha/games/${previewGameCode}/base_files/logo.png`}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </span>
                    <span className="game-asset-picker-copy">
                      <span className="game-asset-picker-game">
                        {previewAssets?.game.name ?? previewGameCode}
                      </span>
                      <span className="game-asset-picker-pack">
                        {previewAssets?.game.packs.find((p) => p.id === previewAssets.packId)?.name ??
                          previewPackId}
                      </span>
                    </span>
                    <span className="game-asset-picker-action">更换</span>
                  </button>
                  <p className="hint compact">
                    示例内容会使用所选游戏与素材包的角色立绘、游戏 Logo；与海报主界面素材可独立设置。
                  </p>
                  <label>
                    副选角色布局
                    <select
                      value={extraCharStyleId}
                      onChange={(e) =>
                        patchLayout({
                          recommendedExtraCharStyleId: e.target.value as ExtraCharStyleId,
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
                    选手 ID 样式
                    <select
                      value={playerIdStyleId}
                      onChange={(e) =>
                        patchLayout({
                          recommendedPlayerIdStyleId: e.target.value as PlayerIdStyleId,
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
                  <label>
                    预览副角色数
                    <input
                      type="number"
                      min={0}
                      max={MAX_EXTRA_CHARACTERS}
                      value={previewExtraCount}
                      onChange={(e) =>
                        patchLayout({
                          previewExtraCount: Math.min(
                            MAX_EXTRA_CHARACTERS,
                            Math.max(0, Number(e.target.value)),
                          ),
                        })
                      }
                    />
                  </label>
                  {extraCharStyleId === 'custom' ? (
                    <ExtraCharLayoutEditor
                      value={layout.recommendedExtraCharLayout}
                      onChange={(recommendedExtraCharLayout) =>
                        patchLayout({ recommendedExtraCharLayout })
                      }
                    />
                  ) : null}
                  {playerIdStyleId === 'custom' ? (
                    <PlayerIdLayoutEditor
                      value={layout.recommendedPlayerIdLayout}
                      onChange={(recommendedPlayerIdLayout) =>
                        patchLayout({ recommendedPlayerIdLayout })
                      }
                    />
                  ) : null}
                </LayoutEditorSection>
              </>
            )}
          </div>
        </aside>
      </div>

      {error ? <p className="error layout-editor-error">{error}</p> : null}

      <GameAssetPickerModal
        open={previewGamePickerOpen}
        catalog={catalog}
        initialGameCode={previewGameCode}
        initialPackId={previewPackId}
        title="选择预览素材"
        onClose={() => setPreviewGamePickerOpen(false)}
        onConfirm={onPreviewGameAssetConfirm}
      />
    </div>
  )
}
