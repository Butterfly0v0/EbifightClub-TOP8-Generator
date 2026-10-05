import type {
  CharacterDef,
  ExtraCharStyleId,
  GameMeta,
  HeaderRegion,
  Layout,
  LayoutSlot,
  LayoutTheme,
  PackConfig,
  PlayerIdStyleId,
  PlayerSlot,
  Point,
  TeamMember,
  Top8Doc,
} from '../types'
import {
  boxFrameKey,
  colorWithOpacity,
  headerImageKey,
  resolveBorderOpacity,
  resolveBorderWidth,
  resolveBoxAccent,
  resolveBoxFill,
  resolveExtraBoxFill,
} from './boxThemes'
import { combinedArtScale, resolveArtScale } from './artScale'
import {
  extraCharactersForRender,
  hasCharArt,
  resolvePickEyes,
} from './characterArt'
import {
  computeExtraCharBoxes,
  resolveArtHeight,
  resolveEffectivePlayerIdStyle,
  resolveExtraCharMode,
  resolveHangGap,
  resolveSideThumbSize,
  type ExtraBoxRect,
} from './extraCharLayout'
import { DEFAULT_HEADER_BG } from './headers'
import { characterUrl, gameLogoUrl, loadImage } from './assets'
import { effectivePosterSettings, resolveLayoutTextModes } from './layoutDefaults'
import { effectiveThemeConfig, THEME_CONFIG_DEFAULTS } from './themeConfig'
import { drawHeader, drawCreditsFromLayout } from './headers'
import {
  drawLayoutTextBox,
  offsetTextBox,
  resolveTextBoxContent,
} from './layoutElements'
import { canvasFont } from './fonts'
import { rankColor, rankLabel } from './rank'
import { memberMainPick, teamArtKey, teamMembersForRender } from './teamMode'
import { isImageSrc } from './userAssets'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight = '700',
  fontId?: string,
  fallback = 'noto-sans',
) {
  let s = size
  ctx.font = canvasFont(s, fontId, weight, fallback)
  while (s > 12 && ctx.measureText(text).width > maxWidth) {
    s -= 1
    ctx.font = canvasFont(s, fontId, weight, fallback)
  }
  return s
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function tryLoad(url: string): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(url)
  } catch {
    return null
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export async function collectImages(
  doc: Top8Doc,
  game: GameMeta | null,
  pack: PackConfig | null,
  layout?: Layout | null,
): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>()
  const jobs: Array<Promise<void>> = []
  const effective = effectivePosterSettings(doc)

  const queue = (key: string, src: string | undefined) => {
    if (!src || !isImageSrc(src)) return
    jobs.push(
      tryLoad(src).then((img) => {
        if (img) map.set(key, img)
      }),
    )
  }

  queue('bg', effective.backgroundImageDataUrl)
  queue('customLogo', effective.logoDataUrl)
  queue(headerImageKey(), doc.customLayout?.headerImageUrl)

  if (layout) {
    for (const slot of layout.slots) {
      const bs = slot.boxStyle ?? doc.defaultBoxStyle
      queue(boxFrameKey(slot.playerIndex, 'main'), bs?.frameImageUrl)
      queue(boxFrameKey(slot.playerIndex, 'extra'), bs?.extraFrameImageUrl)
    }
  }

  if (game) {
    const logo = gameLogoUrl(doc.gameCode)
    jobs.push(
      tryLoad(logo).then((img) => {
        if (img) map.set('logo', img)
      }),
    )
  }

  const queueChar = (key: string, ch: PlayerSlot['characters'][number]) => {
    if (ch.customImageDataUrl) {
      queue(key, ch.customImageDataUrl)
      return
    }
    if (!game || !pack || !ch.codename) return
    const url = characterUrl(game, doc.packId, pack, ch.codename, ch.skin)
    jobs.push(
      tryLoad(url).then((img) => {
        if (img) map.set(key, img)
      }),
    )
  }

  for (const [index, player] of doc.players.entries()) {
    const team = teamMembersForRender(doc, player)
    if (team) {
      team.forEach((member, memberIndex) => {
        const pick = memberMainPick(member)
        if (hasCharArt(pick)) queueChar(teamArtKey(index, memberIndex), pick)
      })
      continue
    }
    const main = player.characters[0]
    if (hasCharArt(main)) queueChar(`${index}:0`, main)
    extraCharactersForRender(player).forEach((ch, i) => {
      queueChar(`${index}:${i + 1}`, ch)
    })
  }

  await Promise.all(jobs)
  return map
}

function drawFaceThumb(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  eyes: Point | undefined,
  artScale = 1,
) {
  const ex = eyes?.x ?? img.width / 2
  const ey = eyes?.y ?? img.height * 0.28
  const zoom = resolveArtScale(artScale)
  const crop = Math.max(32, Math.min(img.width, img.height) * (0.5 / zoom))
  const sx = Math.max(0, Math.min(img.width - crop, ex - crop / 2))
  const sy = Math.max(0, Math.min(img.height - crop, ey - crop * 0.4))
  ctx.drawImage(img, sx, sy, crop, crop, x, y, size, size)
}

function displayName(player: PlayerSlot): string {
  if (player.prefix && player.tag) return `${player.prefix} | ${player.tag}`
  return player.tag || 'TBD'
}

/** 方格 TOP8，以及从方格克隆的自定义布局 */
function isSquaresLayout(doc: Top8Doc): boolean {
  if (doc.layoutId === 'squares') return true
  return doc.layoutId === 'custom' && doc.customLayout?.basedOn === 'squares'
}

function codenameLabel(codename: string): string {
  return codename.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function characterLine(
  player: PlayerSlot,
  names: Map<string, string>,
  teamMode = false,
): string {
  if (teamMode && player.members?.length) {
    return player.members
      .map((member) => {
        const pick = memberMainPick(member)
        if (!hasCharArt(pick)) return ''
        return pick.codename ? (names.get(pick.codename) ?? codenameLabel(pick.codename)) : 'Custom'
      })
      .filter(Boolean)
      .join(' · ')
  }
  return player.characters
    .filter(hasCharArt)
    .map((c) => (c.codename ? (names.get(c.codename) ?? codenameLabel(c.codename)) : 'Custom'))
    .join(' · ')
}

type ArtRect = { x: number; y: number; w: number; h: number }

function teamColumns(rect: ArtRect, count: number): ArtRect[] {
  const gap = count > 1 ? 3 : 0
  const colW = (rect.w - gap * (count - 1)) / count
  return Array.from({ length: count }, (_, i) => ({
    x: rect.x + i * (colW + gap),
    y: rect.y,
    w: colW,
    h: rect.h,
  }))
}

/** 组队赛：在立绘区内并排画每位队员。返回 true 表示已按组队赛绘制。 */
function drawTeamPortraits(
  ctx: CanvasRenderingContext2D,
  rect: ArtRect,
  slot: LayoutSlot,
  members: TeamMember[],
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  artBoost: number,
  cover: number,
  focusX: number,
  focusY: number,
): boolean {
  const cols = teamColumns(rect, members.length)
  members.forEach((member, i) => {
    const cell = cols[i]
    if (!cell) return
    const pick = memberMainPick(member)
    const img = images.get(teamArtKey(slot.playerIndex, i))
    ctx.save()
    ctx.beginPath()
    ctx.rect(cell.x, cell.y, cell.w, cell.h)
    ctx.clip()
    if (img && hasCharArt(pick)) {
      drawCharacterInRect(
        ctx,
        img,
        cell,
        focusX,
        focusY,
        resolvePickEyes(pick, pack, img),
        combinedArtScale(pick.artScale, doc.globalArtScale) * artBoost,
        cover,
      )
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h)
      const mark = member.tag.trim().slice(0, 1) || String(i + 1)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.font = canvasFont(Math.min(cell.w, cell.h) * 0.28, doc.rankFontId, '800', 'bebas')
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(mark, cell.x + cell.w / 2, cell.y + cell.h / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()
    if (i > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)'
      ctx.fillRect(cell.x - 3, cell.y, 3, cell.h)
    }
  })
  return true
}

/** 队员名贴在立绘底部。labelInsetBottom 用来让出名条/叠字，避免和队名重叠。 */
function drawTeamMemberLabels(
  ctx: CanvasRenderingContext2D,
  rect: ArtRect,
  members: TeamMember[],
  playerFont: string,
  labelInsetBottom: number,
) {
  if (rect.h < 88) return
  const cols = teamColumns(rect, members.length)
  members.forEach((member, i) => {
    const cell = cols[i]
    const name = member.tag.trim()
    if (!cell || !name || cell.w < 46) return
    const band = Math.min(28, Math.max(16, cell.h * 0.12))
    const y = cell.y + cell.h - labelInsetBottom - band
    if (y < cell.y + 8) return
    const veil = ctx.createLinearGradient(cell.x, y, cell.x, y + band)
    veil.addColorStop(0, 'rgba(0,0,0,0)')
    veil.addColorStop(1, 'rgba(0,0,0,0.72)')
    ctx.fillStyle = veil
    ctx.fillRect(cell.x, y, cell.w, band)
    const size = fitText(ctx, name, Math.max(12, cell.w - 10), Math.min(15, band - 4), '700', playerFont)
    ctx.font = canvasFont(size, playerFont, '700')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    ctx.fillStyle = '#f7f3ea'
    ctx.strokeText(name, cell.x + cell.w / 2, y + band - 3)
    ctx.fillText(name, cell.x + cell.w / 2, y + band - 3)
  })
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawTokonSideBorders(
  ctx: CanvasRenderingContext2D,
  width: number,
  accent: [number, number, number],
  contentBottom: number,
) {
  const [ar, ag, ab] = accent
  const stripW = 22
  const h = contentBottom

  const leftGrad = ctx.createLinearGradient(0, 0, stripW + 40, 0)
  leftGrad.addColorStop(0, `rgba(${ar},${ag},${ab},0.55)`)
  leftGrad.addColorStop(0.6, `rgba(${ar},${ag},${ab},0.12)`)
  leftGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = leftGrad
  ctx.fillRect(0, 0, stripW + 40, h)

  const rightGrad = ctx.createLinearGradient(width, 0, width - stripW - 40, 0)
  rightGrad.addColorStop(0, `rgba(80,160,255,0.5)`)
  rightGrad.addColorStop(0.6, `rgba(80,160,255,0.1)`)
  rightGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = rightGrad
  ctx.fillRect(width - stripW - 40, 0, stripW + 40, h)

  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.35)`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(stripW, 0)
  ctx.lineTo(stripW + 8, h * 0.2)
  ctx.lineTo(stripW - 4, h * 0.45)
  ctx.lineTo(stripW + 10, h * 0.7)
  ctx.lineTo(stripW, h)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(80,160,255,0.35)'
  ctx.beginPath()
  ctx.moveTo(width - stripW, 0)
  ctx.lineTo(width - stripW - 8, h * 0.25)
  ctx.lineTo(width - stripW + 4, h * 0.5)
  ctx.lineTo(width - stripW - 10, h * 0.75)
  ctx.lineTo(width - stripW, h)
  ctx.stroke()
}

function drawCharacterInRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
  focusX: number,
  focusY: number,
  eyes: Point | undefined,
  artScale = 1,
  coverMultiplier = 1.15,
) {
  const fx = rect.x + rect.w * focusX
  const fy = rect.y + rect.h * focusY
  const ex = eyes?.x ?? img.width / 2
  const ey = eyes?.y ?? img.height * 0.28
  const cover =
    Math.max(rect.w / img.width, rect.h / img.height) * coverMultiplier * resolveArtScale(artScale)
  const dw = img.width * cover
  const dh = img.height * cover
  ctx.drawImage(img, fx - ex * cover, fy - ey * cover, dw, dh)
}

function drawFrameImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.save()
  roundRect(ctx, x, y, w, h, radius)
  ctx.clip()
  drawCover(ctx, img, x, y, w, h)
  ctx.restore()
}

function drawExtraCharThumbs(
  ctx: CanvasRenderingContext2D,
  boxes: ExtraBoxRect[],
  slot: LayoutSlot,
  extras: PlayerSlot['characters'],
  place: number,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
) {
  const boxStyle = slot.boxStyle ?? doc.defaultBoxStyle
  const extraAccent = resolveBoxAccent(place, doc, boxStyle, 'extra')
  const extraFrame = images.get(boxFrameKey(slot.playerIndex, 'extra'))
  const radius = boxStyle.extraBorderRadius ?? 8

  boxes.forEach((box, i) => {
    const pick = extras[i]
    if (!pick) return
    const img = images.get(`${slot.playerIndex}:${i + 1}`)
    ctx.save()
    roundRect(ctx, box.x, box.y, box.w, box.h, radius)
    ctx.clip()
    ctx.fillStyle = resolveExtraBoxFill(place, doc, boxStyle, 1)
    ctx.fill()
    if (img) {
      const eyes = resolvePickEyes(pick, pack, img)
      drawFaceThumb(
        ctx,
        img,
        box.x,
        box.y,
        box.w,
        eyes,
        combinedArtScale(pick.artScale, doc.globalArtScale),
      )
    }
    ctx.restore()
    if (extraFrame) drawFrameImage(ctx, extraFrame, box.x, box.y, box.w, box.h, radius)
    ctx.save()
    roundRect(ctx, box.x, box.y, box.w, box.h, radius)
    ctx.strokeStyle = colorWithOpacity(extraAccent, resolveBorderOpacity(boxStyle, 'extra'))
    ctx.lineWidth = resolveBorderWidth(boxStyle, place, 'extra')
    ctx.stroke()
    ctx.restore()
  })
}

function formatTwitterHandle(player: PlayerSlot): string {
  const raw = player.twitter.trim()
  if (!raw) return ''
  return raw.startsWith('@') ? raw : `@${raw}`
}

function twitterStripHeight(player: PlayerSlot, stripH = 28): number {
  return player.twitter.trim() ? stripH : 0
}

function drawEbifcHealthBarPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: string,
  fillRatio = 0.72,
) {
  ctx.fillStyle = '#0c1422'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, 2)
  ctx.fillRect(x, y + h - 2, w, 2)
  const pad = 4
  const fillW = Math.max(0, (w - pad * 2) * Math.min(1, Math.max(0.2, fillRatio)))
  ctx.fillStyle = fillColor
  ctx.fillRect(x + pad, y + pad, fillW, h - pad * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  for (let i = 1; i < 6; i++) {
    const sx = x + pad + ((w - pad * 2) * i) / 6
    ctx.fillRect(sx, y + pad, 2, h - pad * 2)
  }
}

function renderEbifcPlayerSlot(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  charNames: Map<string, string>,
  accentRgb: [number, number, number],
) {
  const place = player.placement
  const [ar, ag, ab] = accentRgb
  const accent = `rgb(${ar},${ag},${ab})`
  const orange = '#ff8a3d'
  const blue = '#1a9fff'
  const barColor = place === 1 ? orange : place <= 3 ? accent : blue
  const playerFont = doc.playerFontId
  const rankFont = doc.rankFontId
  const plateH = place === 1 ? 52 : Math.min(44, Math.max(36, Math.round(slot.h * 0.12)))
  const twitterH = twitterStripHeight(player, 20)
  const artH = Math.max(40, slot.h - plateH - twitterH)
  const boxStyle = slot.boxStyle ?? doc.defaultBoxStyle
  const mainFrame = images.get(boxFrameKey(slot.playerIndex, 'main'))
  const team = teamMembersForRender(doc, player)
  const extras = team ? [] : extraCharactersForRender(player)
  const showExtraCharNames = doc.showExtraCharNames !== false
  const hasRoster = showExtraCharNames && characterLine(player, charNames, doc.teamMode).length > 0

  // 贴纸投影
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(slot.x + 5, slot.y + 5, slot.w, slot.h)

  ctx.save()
  ctx.beginPath()
  ctx.rect(slot.x, slot.y, slot.w, artH)
  ctx.clip()

  const boxAlpha = Math.min(1, Math.max(0, doc.playerBoxOpacity ?? 1))
  if (boxAlpha > 0) {
    ctx.fillStyle = resolveBoxFill(place, doc, boxStyle, boxAlpha)
    ctx.fillRect(slot.x, slot.y, slot.w, artH)
  }

  const ebifcArt: ArtRect = { x: slot.x, y: slot.y, w: slot.w, h: artH }
  const main = player.characters[0]
  const art = images.get(`${slot.playerIndex}:0`)
  if (team) {
    drawTeamPortraits(ctx, ebifcArt, slot, team, pack, images, doc, 1.06, 1.12, slot.focusX, slot.focusY)
  } else if (art && hasCharArt(main)) {
    const eyes = resolvePickEyes(main, pack, art)
    drawCharacterInRect(
      ctx,
      art,
      ebifcArt,
      slot.focusX,
      slot.focusY,
      eyes,
      combinedArtScale(main?.artScale, doc.globalArtScale) * 1.06,
      1.12,
    )
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.font = canvasFont(Math.min(artH, slot.w) * 0.28, rankFont, '700', 'press-start')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(place), slot.x + slot.w / 2, slot.y + artH / 2)
    ctx.textAlign = 'left'
  }

  // 底部渐隐
  const veil = ctx.createLinearGradient(slot.x, slot.y + artH * 0.55, slot.x, slot.y + artH)
  veil.addColorStop(0, 'rgba(8,12,20,0)')
  veil.addColorStop(1, 'rgba(8,12,20,0.72)')
  ctx.fillStyle = veil
  ctx.fillRect(slot.x, slot.y, slot.w, artH)
  if (team) drawTeamMemberLabels(ctx, ebifcArt, team, playerFont, 8)
  ctx.restore()

  if (mainFrame) {
    drawFrameImage(ctx, mainFrame, slot.x, slot.y, slot.w, artH, 0)
  }

  // 血条名牌
  const plateY = slot.y + artH
  drawEbifcHealthBarPlate(ctx, slot.x, plateY, slot.w, plateH, barColor, place === 1 ? 0.88 : 0.7)

  const name = displayName(player)
  const namePad = 12
  const nameMax = slot.w - namePad * 2 - (place === 1 ? 70 : 56)
  const ns = fitText(ctx, name, nameMax, slot.nameSize, '800', playerFont)
  ctx.font = canvasFont(ns, playerFont, '800')
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.lineWidth = 4
  ctx.fillStyle = '#ffffff'
  ctx.strokeText(name, slot.x + namePad, plateY + plateH / 2)
  ctx.fillText(name, slot.x + namePad, plateY + plateH / 2)

  const rankText = rankLabel(place)
  ctx.font = canvasFont(Math.min(16, plateH - 14), rankFont, '700', 'press-start')
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.strokeText(rankText, slot.x + slot.w - namePad, plateY + plateH / 2)
  ctx.fillText(rankText, slot.x + slot.w - namePad, plateY + plateH / 2)
  ctx.textAlign = 'left'

  if (twitterH > 0) {
    const handle = formatTwitterHandle(player)
    ctx.fillStyle = '#0c1422'
    ctx.fillRect(slot.x, plateY + plateH, slot.w, twitterH)
    ctx.fillStyle = 'rgba(247,243,234,0.85)'
    const ts = fitText(ctx, handle, slot.w - 20, 12, '600', playerFont)
    ctx.font = canvasFont(ts, playerFont, '600')
    ctx.textBaseline = 'middle'
    ctx.fillText(handle, slot.x + 10, plateY + plateH + twitterH / 2)
  }

  if (showExtraCharNames && hasRoster) {
    const roster = characterLine(player, charNames, doc.teamMode)
    ctx.fillStyle = 'rgba(247,243,234,0.75)'
    const rs = fitText(ctx, roster, nameMax, 12, '500', playerFont)
    ctx.font = canvasFont(rs, playerFont, '500')
    ctx.textBaseline = 'bottom'
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 3
    ctx.strokeText(roster, slot.x + namePad, plateY - 8)
    ctx.fillText(roster, slot.x + namePad, plateY - 8)
  }

  // 副角色：贴在立绘区右下、名牌上方，白边像素框（后画避免被挡住）
  if (extras.length > 0) {
    drawEbifcExtraThumbs(ctx, slot, extras, place, pack, images, doc, artH)
  }

  // 白边贴纸框
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 5
  ctx.strokeRect(slot.x + 2.5, slot.y + 2.5, slot.w - 5, slot.h - 5)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 1
  ctx.strokeRect(slot.x + 6.5, slot.y + 6.5, slot.w - 13, slot.h - 13)
}

function drawEbifcExtraThumbs(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  extras: PlayerSlot['characters'],
  place: number,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  artH: number,
) {
  const gap = 6
  const pad = 10
  const maxThumb = place === 1 ? 78 : slot.w >= 300 ? 64 : 48
  const count = extras.length
  let thumb = maxThumb
  const maxRowW = slot.w - pad * 2
  if (count * thumb + (count - 1) * gap > maxRowW) {
    thumb = Math.max(28, Math.floor((maxRowW - (count - 1) * gap) / count))
  }
  const totalW = count * thumb + (count - 1) * gap
  let x = slot.x + slot.w - pad - totalW
  const y = slot.y + artH - pad - thumb

  extras.forEach((pick, i) => {
    const img = images.get(`${slot.playerIndex}:${i + 1}`)
    // 投影
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(x + 3, y + 3, thumb, thumb)
    // 底
    ctx.fillStyle = '#101828'
    ctx.fillRect(x, y, thumb, thumb)
    if (img) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(x + 3, y + 3, thumb - 6, thumb - 6)
      ctx.clip()
      const eyes = resolvePickEyes(pick, pack, img)
      drawFaceThumb(
        ctx,
        img,
        x + 3,
        y + 3,
        thumb - 6,
        eyes,
        combinedArtScale(pick.artScale, doc.globalArtScale),
      )
      ctx.restore()
    }
    // 白边贴纸
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.strokeRect(x + 1.5, y + 1.5, thumb - 3, thumb - 3)
    ctx.strokeStyle = place <= 3 ? '#ff8a3d' : '#1a9fff'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 4.5, y + 4.5, thumb - 9, thumb - 9)
    x += thumb + gap
  })
}

function drawEbifcBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // 深色底已由 renderTop8 填充；叠加像素网格与速度线
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'
  ctx.lineWidth = 1
  for (let x = 0; x < width; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y < height; y += 16) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,138,61,0.08)'
  ctx.lineWidth = 3
  for (let i = -height; i < width; i += 48) {
    ctx.beginPath()
    ctx.moveTo(i, height * 0.15)
    ctx.lineTo(i + 120, height * 0.15)
    ctx.stroke()
  }
  ctx.restore()
}

function prismPlateHeight(place: number, slotH: number): number {
  if (place === 1) return 56
  if (slotH < 280) return 34
  return 42
}

function prismPlatePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + cut, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + cut)
  ctx.closePath()
}

function drawPrismBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  accent: [number, number, number],
) {
  const [ar, ag, ab] = accent
  ctx.save()

  const spot = ctx.createRadialGradient(960, 420, 40, 960, 420, 780)
  spot.addColorStop(0, `rgba(${ar},${ag},${ab},0.22)`)
  spot.addColorStop(0.42, `rgba(${ar},${ag},${ab},0.07)`)
  spot.addColorStop(1, 'rgba(8,6,26,0)')
  ctx.fillStyle = spot
  ctx.fillRect(0, 0, width, height)

  const cyanGlow = ctx.createRadialGradient(80, 80, 10, 80, 80, 420)
  cyanGlow.addColorStop(0, 'rgba(34,211,238,0.16)')
  cyanGlow.addColorStop(1, 'rgba(34,211,238,0)')
  ctx.fillStyle = cyanGlow
  ctx.fillRect(0, 0, 520, 520)

  const violetGlow = ctx.createRadialGradient(width - 40, height - 40, 10, width - 40, height - 40, 480)
  violetGlow.addColorStop(0, `rgba(${ar},${ag},${ab},0.18)`)
  violetGlow.addColorStop(1, 'rgba(8,6,26,0)')
  ctx.fillStyle = violetGlow
  ctx.fillRect(width - 560, height - 560, 560, 560)

  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.08)`
  ctx.lineWidth = 1.5
  for (let i = 0; i < 7; i++) {
    const x0 = 80 + i * 280
    ctx.beginPath()
    ctx.moveTo(x0, 0)
    ctx.lineTo(x0 + 220, height)
    ctx.stroke()
  }

  const vig = ctx.createRadialGradient(960, 540, 380, 960, 540, 920)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(4,2,14,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function drawPrismExtraThumbs(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  extras: PlayerSlot['characters'],
  place: number,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  artH: number,
  accentRgb: [number, number, number],
) {
  const [ar, ag, ab] = accentRgb
  const gap = 6
  const pad = 12
  const maxThumb = place === 1 ? 62 : slot.w >= 480 ? 48 : 38
  const count = extras.length
  let thumb = maxThumb
  const maxRowW = slot.w * 0.46
  if (count * thumb + (count - 1) * gap > maxRowW) {
    thumb = Math.max(26, Math.floor((maxRowW - (count - 1) * gap) / count))
  }
  const totalW = count * thumb + (count - 1) * gap
  let x = slot.x + slot.w - pad - totalW
  const y = slot.y + artH - pad - thumb
  const r = thumb / 2

  extras.forEach((pick, i) => {
    const img = images.get(`${slot.playerIndex}:${i + 1}`)
    const cx = x + r
    const cy = y + r
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx + 2, cy + 3, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#0c0a1c'
    ctx.fill()
    ctx.clip()
    if (img) {
      const eyes = resolvePickEyes(pick, pack, img)
      drawFaceThumb(
        ctx,
        img,
        x,
        y,
        thumb,
        eyes,
        combinedArtScale(pick.artScale, doc.globalArtScale),
      )
    }
    ctx.restore()
    ctx.beginPath()
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
    ctx.strokeStyle = place === 1 ? '#22d3ee' : `rgb(${ar},${ag},${ab})`
    ctx.lineWidth = 2
    ctx.stroke()
    x += thumb + gap
  })
}

function renderPrismPlayerSlot(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  charNames: Map<string, string>,
  accentRgb: [number, number, number],
) {
  const place = player.placement
  const [ar, ag, ab] = accentRgb
  const accent = `rgb(${ar},${ag},${ab})`
  const cyan = '#22d3ee'
  const playerFont = doc.playerFontId
  const rankFont = doc.rankFontId
  const plateH = prismPlateHeight(place, slot.h)
  const cut = place === 1 ? 22 : 14
  const artH = Math.max(40, slot.h - plateH)
  const boxStyle = slot.boxStyle ?? doc.defaultBoxStyle
  const mainFrame = images.get(boxFrameKey(slot.playerIndex, 'main'))
  const team = teamMembersForRender(doc, player)
  const extras = team ? [] : extraCharactersForRender(player)
  const showExtraCharNames = doc.showExtraCharNames !== false
  const radius = slot.radius
  const tc = effectiveThemeConfig(doc)
  const handle = formatTwitterHandle(player)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = place === 1 ? 18 : 8
  ctx.shadowOffsetY = 3
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, radius)
  ctx.fillStyle = '#0c0a1c'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, slot.x, slot.y, slot.w, artH, radius)
  ctx.clip()

  const boxAlpha = Math.min(1, Math.max(0, doc.playerBoxOpacity ?? 1))
  if (boxAlpha > 0) {
    ctx.fillStyle = resolveBoxFill(place, doc, boxStyle, boxAlpha)
    ctx.fillRect(slot.x, slot.y, slot.w, artH)
  }

  const prismArt: ArtRect = { x: slot.x, y: slot.y, w: slot.w, h: artH }
  const prismBoost = (place === 1 ? 1.12 : 1.06) * tc.slotArtBoost
  const main = player.characters[0]
  const art = images.get(`${slot.playerIndex}:0`)
  if (team) {
    drawTeamPortraits(
      ctx,
      prismArt,
      slot,
      team,
      pack,
      images,
      doc,
      prismBoost,
      tc.artCoverMultiplier,
      slot.focusX,
      slot.focusY,
    )
  } else if (art && hasCharArt(main)) {
    const eyes = resolvePickEyes(main, pack, art)
    drawCharacterInRect(
      ctx,
      art,
      prismArt,
      slot.focusX,
      slot.focusY,
      eyes,
      combinedArtScale(main?.artScale, doc.globalArtScale) * prismBoost,
      tc.artCoverMultiplier,
    )
  } else {
    ctx.fillStyle = 'rgba(244,241,255,0.08)'
    ctx.font = canvasFont(Math.min(artH, slot.w) * 0.28, rankFont, '700', 'orbitron')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(place), slot.x + slot.w / 2, slot.y + artH / 2)
    ctx.textAlign = 'left'
  }

  const veil = ctx.createLinearGradient(slot.x, slot.y + artH * 0.48, slot.x, slot.y + artH)
  veil.addColorStop(0, 'rgba(8,6,26,0)')
  veil.addColorStop(0.55, 'rgba(8,6,26,0.35)')
  veil.addColorStop(1, 'rgba(8,6,26,0.88)')
  ctx.fillStyle = veil
  ctx.fillRect(slot.x, slot.y, slot.w, artH)
  if (team) drawTeamMemberLabels(ctx, prismArt, team, playerFont, 8)
  ctx.restore()

  if (mainFrame) {
    drawFrameImage(ctx, mainFrame, slot.x, slot.y, slot.w, artH, radius)
  }

  const plateY = slot.y + artH
  ctx.save()
  prismPlatePath(ctx, slot.x, plateY, slot.w, plateH, cut)
  const plateFill = ctx.createLinearGradient(slot.x, plateY, slot.x + slot.w, plateY)
  if (place === 1) {
    plateFill.addColorStop(0, `rgba(${ar},${ag},${ab},0.92)`)
    plateFill.addColorStop(0.55, 'rgba(18,12,42,0.96)')
    plateFill.addColorStop(1, 'rgba(12,10,32,0.96)')
  } else {
    plateFill.addColorStop(0, 'rgba(16,12,36,0.96)')
    plateFill.addColorStop(1, 'rgba(10,8,24,0.96)')
  }
  ctx.fillStyle = plateFill
  ctx.fill()
  ctx.restore()

  const name = displayName(player)
  const namePad = cut + 10
  const nameMax = slot.w - namePad - 16
  const nameSize = fitText(ctx, name, nameMax, slot.nameSize, '800', playerFont)
  ctx.font = canvasFont(nameSize, playerFont, '800')
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f4f1ff'
  const nameY = handle ? plateY + plateH * 0.38 : plateY + plateH / 2
  ctx.fillText(name, slot.x + namePad, nameY)
  if (handle) {
    const ts = fitText(ctx, handle, nameMax, 12, '500', playerFont)
    ctx.font = canvasFont(ts, playerFont, '500')
    ctx.fillStyle = cyan
    ctx.fillText(handle, slot.x + namePad, plateY + plateH * 0.72)
  }

  if (showExtraCharNames) {
    const roster = characterLine(player, charNames, doc.teamMode)
    if (roster && !handle && plateH >= 42) {
      const rs = fitText(ctx, roster, nameMax, 11, '500', playerFont)
      ctx.font = canvasFont(rs, playerFont, '500')
      ctx.fillStyle = 'rgba(244,241,255,0.62)'
      ctx.textBaseline = 'bottom'
      ctx.fillText(roster, slot.x + namePad, plateY - 8)
      ctx.textBaseline = 'middle'
    }
  }

  if (extras.length > 0) {
    drawPrismExtraThumbs(ctx, slot, extras, place, pack, images, doc, artH, accentRgb)
  }

  ctx.save()
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, radius)
  ctx.strokeStyle = place === 1 ? cyan : `rgba(${ar},${ag},${ab},0.85)`
  ctx.lineWidth = place === 1 ? 2 : 1.5
  ctx.stroke()
  ctx.restore()

  if (place === 1) {
    const gemX = slot.x + slot.w - 28
    const gemY = slot.y + 24
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(gemX, gemY - 9)
    ctx.lineTo(gemX + 7, gemY)
    ctx.lineTo(gemX, gemY + 9)
    ctx.lineTo(gemX - 7, gemY)
    ctx.closePath()
    const gem = ctx.createLinearGradient(gemX - 8, gemY - 8, gemX + 8, gemY + 8)
    gem.addColorStop(0, cyan)
    gem.addColorStop(1, accent)
    ctx.fillStyle = gem
    ctx.fill()
    ctx.restore()
  }

  const rankText = rankLabel(place)
  ctx.save()
  ctx.font = canvasFont(slot.placeSize, rankFont, '700', 'orbitron')
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const rankX = slot.x + 14
  const rankY = slot.y + 10
  const rankW = ctx.measureText(rankText).width
  const rankH = slot.placeSize * 0.78
  roundRect(ctx, rankX - 8, rankY - 4, rankW + 16, rankH + 8, 8)
  ctx.fillStyle = 'rgba(8,6,26,0.78)'
  ctx.fill()
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = place === 1 ? 6 : 5
  ctx.strokeStyle = 'rgba(8,6,26,0.95)'
  ctx.fillStyle = place === 1 ? cyan : '#f4f1ff'
  ctx.strokeText(rankText, rankX, rankY)
  ctx.fillText(rankText, rankX, rankY)
  ctx.restore()
}

function drawPlayerIdentity(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  charNames: Map<string, string>,
  idStyle: 'overlay' | 'inCard' | 'hang',
  plateY: number,
  plateH: number,
  accent: string,
  place: number,
  playerFont: string,
  showExtraCharNames: boolean,
  twitterH: number,
  teamMode = false,
  nameMaxOverride?: number,
  centerName = false,
) {
  const name = displayName(player)
  const nameMax = nameMaxOverride ?? slot.w - 24
  const handle = formatTwitterHandle(player)
  const textX = (pad: number) => (centerName ? slot.x + slot.w / 2 : slot.x + pad)
  if (centerName) ctx.textAlign = 'center'

  if (idStyle === 'overlay') {
    ctx.fillStyle = '#f7f3ea'
    const ns = fitText(ctx, name, nameMax, slot.nameSize, '800', playerFont)
    ctx.font = canvasFont(ns, playerFont, '800')
    ctx.textBaseline = 'bottom'
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    const nameY = slot.y + slot.h - 14
    const nameX = textX(16)
    if (handle) {
      const ts = fitText(ctx, handle, nameMax, 14, '500', playerFont)
      ctx.font = canvasFont(ts, playerFont, '500')
      ctx.fillStyle = 'rgba(247,243,234,0.78)'
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'
      ctx.lineWidth = 4
      ctx.strokeText(handle, nameX, nameY - ns - 6)
      ctx.fillText(handle, nameX, nameY - ns - 6)
      ctx.fillStyle = '#f7f3ea'
      ctx.font = canvasFont(ns, playerFont, '800')
      ctx.lineWidth = 5
      ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    }
    ctx.strokeText(name, nameX, nameY)
    ctx.fillText(name, nameX, nameY)
    if (centerName) ctx.textAlign = 'left'
    return
  }

  if (idStyle === 'hang') {
    ctx.fillStyle = accent
    ctx.fillRect(slot.x, plateY - 2, slot.w, 2)
  }

  const namePlateH = Math.max(24, plateH - twitterH)
  ctx.fillStyle = place === 1 ? accent : idStyle === 'hang' ? '#0f1628' : '#1a2744'
  ctx.fillRect(slot.x, plateY, slot.w, namePlateH)

  if (twitterH > 0) {
    ctx.fillStyle = '#0f1628'
    ctx.fillRect(slot.x, plateY + namePlateH, slot.w, twitterH)
  }

  ctx.fillStyle = '#f7f3ea'
  const nameY = plateY + (place === 1 ? 14 : 10)
  const ns = fitText(ctx, name, nameMax, place === 1 ? 26 : slot.nameSize, '800', playerFont)
  ctx.font = canvasFont(ns, playerFont, '800')
  ctx.textBaseline = 'top'
  const nameX = textX(12)
  ctx.fillText(name, nameX, nameY)

  if (showExtraCharNames) {
    const roster = characterLine(player, charNames, teamMode)
    if (roster) {
      ctx.fillStyle = 'rgba(247,243,234,0.65)'
      const rosterY = nameY + ns + 4
      if (rosterY < plateY + namePlateH - 6) {
        const rs = fitText(ctx, roster, nameMax, 13, '500', playerFont)
        ctx.font = canvasFont(rs, playerFont, '500')
        ctx.fillText(roster, nameX, rosterY)
      }
    }
  }

  if (handle && twitterH > 0) {
    ctx.fillStyle = 'rgba(247,243,234,0.88)'
    const ts = fitText(ctx, handle, slot.w - 24, 13, '500', playerFont)
    ctx.font = canvasFont(ts, playerFont, '500')
    ctx.textBaseline = 'middle'
    ctx.fillText(handle, nameX, plateY + namePlateH + twitterH / 2)
    ctx.textBaseline = 'top'
  }
  if (centerName) ctx.textAlign = 'left'
}

function drawParagonPlayerIdentity(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  accent: string,
  plateY: number,
  namePlateH: number,
  twitterH: number,
  place: number,
  playerFont: string,
) {
  const name = displayName(player).toUpperCase()
  const handle = formatTwitterHandle(player)

  ctx.fillStyle = accent
  ctx.fillRect(slot.x, plateY, slot.w, namePlateH)

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const ns = fitText(ctx, name, slot.w - 16, place === 1 ? 26 : slot.nameSize, '800', playerFont)
  ctx.font = canvasFont(ns, playerFont, '800')
  ctx.fillText(name, slot.x + slot.w / 2, plateY + namePlateH / 2)

  if (handle && twitterH > 0) {
    const twitterY = plateY + namePlateH
    ctx.fillStyle = '#141c2e'
    ctx.fillRect(slot.x, twitterY, slot.w, twitterH)
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    const ts = fitText(ctx, handle, slot.w - 12, 13, '500', playerFont)
    ctx.font = canvasFont(ts, playerFont, '500')
    ctx.fillText(handle, slot.x + slot.w / 2, twitterY + twitterH / 2)
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  stroke = 'rgba(0,0,0,0.78)',
  lineWidth = 4,
) {
  ctx.strokeStyle = stroke
  ctx.lineWidth = lineWidth
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

type AnimefgcListTypography = { nameSize: number; handleSize: number }

function animefgcInfoWidth(slotW: number): number {
  return Math.min(200, Math.max(140, Math.round(slotW * 0.26)))
}

function computeAnimefgcListTypography(
  ctx: CanvasRenderingContext2D,
  doc: Top8Doc,
  slots: LayoutSlot[],
  playerFont: string,
): AnimefgcListTypography {
  const BASE_NAME = 26
  const BASE_HANDLE = 15
  const listSlots = slots.filter((s) => s.playerIndex > 0)
  if (listSlots.length === 0) return { nameSize: BASE_NAME, handleSize: BASE_HANDLE }

  const textMax = animefgcInfoWidth(listSlots[0].w) - 20
  let nameSize = BASE_NAME
  for (const slot of listSlots) {
    const player = doc.players[slot.playerIndex]
    if (!player) continue
    const name = displayName(player).toUpperCase()
    nameSize = Math.min(nameSize, fitText(ctx, name, textMax, BASE_NAME, '800', playerFont))
  }
  return { nameSize, handleSize: BASE_HANDLE }
}

function drawAnimefgcExtraChars(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  place: number,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  _charNames: Map<string, string>,
  variant: 'champion' | 'list',
) {
  if (teamMembersForRender(doc, player)) return
  const eff = effectivePosterSettings(doc)
  const tc = effectiveThemeConfig(doc)
  const extras = extraCharactersForRender(player)
  const extraCount = extras.length
  if (extraCount === 0) return

  const extraMode = resolveExtraCharMode(eff.extraCharStyleId, eff.extraCharLayout)
  const namePlateH = variant === 'champion' ? tc.animefgcChampBarH : 0
  const artH = slot.h - namePlateH
  let boxes: ExtraBoxRect[]

  if (extraMode === 'sideStack') {
    const thumbGap = eff.extraCharLayout?.gap ?? 6
    let thumbSize = resolveSideThumbSize(place, slot, artH, extraCount, eff.extraCharLayout)
    if (variant === 'list') thumbSize = Math.min(thumbSize, 42)
    const padRight = variant === 'champion' ? 20 : 8
    const stripX =
      variant === 'champion'
        ? slot.x + slot.w - thumbSize - padRight
        : slot.x + 98
    const totalH = extraCount * thumbSize + (extraCount - 1) * thumbGap
    let ty = slot.y + Math.max(6, (artH - totalH) / 2)
    boxes = Array.from({ length: extraCount }, (_, i) => {
      const rect = { x: stripX, y: ty, w: thumbSize, h: thumbSize, label: `副${i + 1}` }
      ty += thumbSize + thumbGap
      return rect
    })
  } else {
    const gap = eff.extraCharLayout?.gap ?? (variant === 'champion' ? 10 : 5)
    let size = eff.extraCharLayout?.thumbSize ?? (variant === 'champion' ? 72 : 40)
    if (variant === 'list') size = Math.min(size, 42)
    const padBottom = variant === 'champion' ? 108 : 8
    const startX = variant === 'champion' ? slot.x + 24 : slot.x + 96
    const maxW = variant === 'list' ? slot.w * 0.42 : slot.w - 48
    const needed = extraCount * size + (extraCount - 1) * gap
    if (needed > maxW) {
      size = Math.max(
        variant === 'list' ? 26 : 44,
        Math.floor((maxW - (extraCount - 1) * gap) / extraCount),
      )
    }
    const bottomY = slot.y + artH - padBottom - size
    boxes = Array.from({ length: extraCount }, (_, i) => ({
      x: startX + i * (size + gap),
      y: bottomY,
      w: size,
      h: size,
      label: `副${i + 1}`,
    }))
  }

  drawExtraCharThumbs(ctx, boxes, slot, extras, place, pack, images, doc)
}

function renderAnimefgcChampionSlot(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  charNames: Map<string, string>,
  playerFont: string,
  rankFont: string,
) {
  const tc = effectiveThemeConfig(doc)
  const namePlateH = tc.animefgcChampBarH
  const artH = slot.h - namePlateH
  const team = teamMembersForRender(doc, player)
  const champArt: ArtRect = { x: slot.x, y: slot.y, w: slot.w, h: artH }
  const main = player.characters[0]
  const art = images.get(`${slot.playerIndex}:0`)

  ctx.save()
  ctx.beginPath()
  ctx.rect(slot.x, slot.y, slot.w, artH)
  ctx.clip()

  if (team) {
    drawTeamPortraits(
      ctx,
      champArt,
      slot,
      team,
      pack,
      images,
      doc,
      tc.animefgcChampArtBoost,
      tc.artCoverMultiplier,
      0.56,
      0.3,
    )
  } else if (art && hasCharArt(main)) {
    const eyes = resolvePickEyes(main, pack, art)
    drawCharacterInRect(
      ctx,
      art,
      champArt,
      0.56,
      0.30,
      eyes,
      combinedArtScale(main?.artScale, doc.globalArtScale) * tc.animefgcChampArtBoost,
      tc.artCoverMultiplier,
    )
  }

  const veilStartY = slot.y + artH * (Number.isFinite(tc.animefgcChampVeilStart) ? tc.animefgcChampVeilStart : 0.38)
  if (Number.isFinite(slot.x) && Number.isFinite(veilStartY) && Number.isFinite(artH) && artH > 0) {
    const veil = ctx.createLinearGradient(slot.x, veilStartY, slot.x, slot.y + artH)
    veil.addColorStop(0, 'rgba(8,8,12,0)')
    veil.addColorStop(0.5, 'rgba(8,8,12,0.62)')
    veil.addColorStop(1, 'rgba(8,8,12,0.95)')
    ctx.fillStyle = veil
    ctx.fillRect(slot.x, slot.y, slot.w, artH)
  }
  if (team) drawTeamMemberLabels(ctx, champArt, team, playerFont, 96)
  ctx.restore()

  drawAnimefgcExtraChars(ctx, slot, player, player.placement, pack, images, doc, charNames, 'champion')

  const plateY = slot.y + artH
  const barGrad = ctx.createLinearGradient(slot.x, plateY, slot.x + slot.w, plateY)
  barGrad.addColorStop(0, '#9a7209')
  barGrad.addColorStop(0.35, '#f5d547')
  barGrad.addColorStop(0.65, '#ffe566')
  barGrad.addColorStop(1, '#9a7209')
  ctx.fillStyle = barGrad
  ctx.fillRect(slot.x, plateY, slot.w, namePlateH)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(slot.x + 1, plateY + 1, slot.w - 2, namePlateH - 2)

  const rankY = plateY - 10
  const rankSize = Math.max(slot.placeSize, 84)
  ctx.fillStyle = rankColor(1, '#f5c518')
  ctx.font = canvasFont(rankSize, rankFont, '800', 'bebas', 'italic')
  ctx.textBaseline = 'bottom'
  ctx.textAlign = 'left'
  drawOutlinedText(ctx, '1ST', slot.x + 28, rankY, rankColor(1, '#f5c518'), 'rgba(0,0,0,0.82)', 5)

  const name = displayName(player).toUpperCase()
  const handle = formatTwitterHandle(player)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const ns = fitText(ctx, name, slot.w - 48, 42, '800', playerFont)
  ctx.font = canvasFont(ns, playerFont, '800')
  const nameY = handle ? plateY + namePlateH * 0.4 : plateY + namePlateH / 2
  drawOutlinedText(ctx, name, slot.x + slot.w / 2, nameY, '#fffefb', 'rgba(0,0,0,0.55)', 3)
  if (handle) {
    ctx.font = canvasFont(16, playerFont, '600')
    drawOutlinedText(
      ctx,
      handle,
      slot.x + slot.w / 2,
      plateY + namePlateH * 0.76,
      'rgba(255,254,251,0.92)',
      'rgba(0,0,0,0.5)',
      2,
    )
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function renderAnimefgcListSlot(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  charNames: Map<string, string>,
  accent: string,
  playerFont: string,
  rankFont: string,
  listTypography: AnimefgcListTypography,
) {
  const place = player.placement
  const tc = effectiveThemeConfig(doc)
  const textPad = 16
  const rankSize = 28

  const team = teamMembersForRender(doc, player)
  const listArt: ArtRect = { x: slot.x, y: slot.y, w: slot.w, h: slot.h }
  const main = player.characters[0]
  const art = images.get(`${slot.playerIndex}:0`)
  ctx.save()
  if (slot.radius > 0) {
    roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.radius)
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.rect(slot.x, slot.y, slot.w, slot.h)
    ctx.clip()
  }
  if (team) {
    drawTeamPortraits(
      ctx,
      listArt,
      slot,
      team,
      pack,
      images,
      doc,
      tc.animefgcListArtBoost,
      tc.artCoverMultiplier,
      0.5,
      0.28,
    )
  } else if (art && hasCharArt(main)) {
    const eyes = resolvePickEyes(main, pack, art)
    drawCharacterInRect(
      ctx,
      art,
      listArt,
      0.5,
      0.28,
      eyes,
      combinedArtScale(main?.artScale, doc.globalArtScale) * tc.animefgcListArtBoost,
      tc.artCoverMultiplier,
    )
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.font = canvasFont(Math.min(slot.w, slot.h) * 0.35, rankFont, '800', 'bebas')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(place), slot.x + slot.w / 2, slot.y + slot.h / 2)
  }
  if (team) drawTeamMemberLabels(ctx, listArt, team, playerFont, 4)
  ctx.restore()

  drawAnimefgcExtraChars(ctx, slot, player, place, pack, images, doc, charNames, 'list')

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  if (slot.radius > 0) {
    roundRect(ctx, slot.x + 0.5, slot.y + 0.5, slot.w - 1, slot.h - 1, slot.radius)
    ctx.stroke()
  } else {
    ctx.strokeRect(slot.x + 0.5, slot.y + 0.5, slot.w - 1, slot.h - 1)
  }

  const rankText = rankLabel(place)
  ctx.font = canvasFont(rankSize, rankFont, '800', 'bebas', 'italic')
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  drawOutlinedText(
    ctx,
    rankText,
    slot.x + textPad,
    slot.y + slot.h / 2,
    rankColor(place, accent),
    'rgba(0,0,0,0.78)',
    4,
  )

  const name = displayName(player).toUpperCase()
  const handle = formatTwitterHandle(player)
  const rightX = slot.x + slot.w - textPad
  const midY = slot.y + slot.h / 2
  ctx.textAlign = 'right'
  ctx.font = canvasFont(listTypography.nameSize, playerFont, '800')
  if (handle) {
    drawOutlinedText(ctx, name, rightX, midY - 12, '#f7f3ea', 'rgba(0,0,0,0.78)', 4)
    ctx.font = canvasFont(listTypography.handleSize, playerFont, '500')
    drawOutlinedText(
      ctx,
      handle,
      rightX,
      midY + 12,
      'rgba(247,243,234,0.88)',
      'rgba(0,0,0,0.72)',
      3,
    )
  } else {
    drawOutlinedText(ctx, name, rightX, midY, '#f7f3ea', 'rgba(0,0,0,0.78)', 4)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function renderAnimefgcPlayerSlot(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  doc: Top8Doc,
  charNames: Map<string, string>,
  accentRgb: [number, number, number],
  listTypography?: AnimefgcListTypography,
) {
  const [ar, ag, ab] = accentRgb
  const accent = `rgb(${ar},${ag},${ab})`
  const playerFont = doc.playerFontId
  const rankFont = doc.rankFontId
  const typography = listTypography ?? { nameSize: 26, handleSize: 15 }

  if (player.placement === 1) {
    renderAnimefgcChampionSlot(
      ctx,
      slot,
      player,
      pack,
      images,
      doc,
      charNames,
      playerFont,
      rankFont,
    )
  } else {
    renderAnimefgcListSlot(
      ctx,
      slot,
      player,
      pack,
      images,
      doc,
      charNames,
      accent,
      playerFont,
      rankFont,
      typography,
    )
  }
}

function renderPlayerSlot(
  ctx: CanvasRenderingContext2D,
  slot: LayoutSlot,
  player: PlayerSlot,
  doc: Top8Doc,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  charNames: Map<string, string>,
  accentRgb: [number, number, number],
  layoutTheme: LayoutTheme = 'default',
  animefgcListTypography?: AnimefgcListTypography,
) {
  if (layoutTheme === 'animefgc') {
    renderAnimefgcPlayerSlot(
      ctx,
      slot,
      player,
      pack,
      images,
      doc,
      charNames,
      accentRgb,
      animefgcListTypography,
    )
    return
  }

  if (layoutTheme === 'ebifc') {
    renderEbifcPlayerSlot(ctx, slot, player, pack, images, doc, charNames, accentRgb)
    return
  }

  if (layoutTheme === 'prism') {
    renderPrismPlayerSlot(ctx, slot, player, pack, images, doc, charNames, accentRgb)
    return
  }

  const place = player.placement
  const eff = effectivePosterSettings(doc)
  const tc = effectiveThemeConfig(doc)
  const boxStyle = slot.boxStyle ?? doc.defaultBoxStyle
  const accent = resolveBoxAccent(place, doc, boxStyle, 'main')
  const [ar, ag, ab] = accentRgb
  const playerFont = doc.playerFontId
  const rankFont = doc.rankFontId
  const mainFrame = images.get(boxFrameKey(slot.playerIndex, 'main'))
  const extraStyle: ExtraCharStyleId = eff.extraCharStyleId
  const idStyle: PlayerIdStyleId = eff.playerIdStyleId
  const effectiveId = resolveEffectivePlayerIdStyle(idStyle, eff.playerIdLayout)
  const tokon = layoutTheme === 'tokon'
  const paragon = layoutTheme === 'paragon'
  const team = teamMembersForRender(doc, player)
  const centerTeamName = doc.teamMode && isSquaresLayout(doc)
  const extras = team ? [] : extraCharactersForRender(player)
  const extraCount = extras.length
  const showExtraCharNames = doc.showExtraCharNames !== false
  const hasRoster = showExtraCharNames && characterLine(player, charNames, doc.teamMode).length > 0
  const hangGap = resolveHangGap(idStyle, eff.playerIdLayout)
  const twitterH = twitterStripHeight(player, tc.twitterStripH)
  const paragonTwitterH = paragon ? twitterH : 0
  const paragonNamePlateH = paragon
    ? place === 1
      ? tc.paragonChampPlateH
      : tc.paragonPlateH
    : 0
  const paragonBottomH = paragon ? paragonNamePlateH + paragonTwitterH : 0
  const artH = paragon
    ? slot.h - paragonBottomH
    : (() => {
        let h = resolveArtHeight(slot, place, idStyle, hasRoster, eff.playerIdLayout)
        if (twitterH > 0 && effectiveId !== 'overlay') h -= twitterH
        return h
      })()
  const plateH = paragon
    ? paragonBottomH
    : effectiveId === 'overlay'
      ? 0
      : slot.h - artH - hangGap
  const extraBoxes =
    extraCount > 0
      ? computeExtraCharBoxes(slot, {
          place,
          extraCharStyleId: extraStyle,
          playerIdStyleId: idStyle,
          extraCount,
          hasRoster,
          extraCharLayout: eff.extraCharLayout,
          playerIdLayout: eff.playerIdLayout,
        })
      : []

  const artRect = {
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: artH,
  }
  const clipH = paragon || effectiveId !== 'overlay' ? artH : slot.h

  ctx.save()
  if (slot.radius > 0) {
    roundRect(ctx, slot.x, slot.y, slot.w, clipH, slot.radius)
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.rect(slot.x, slot.y, slot.w, clipH)
    ctx.clip()
  }

  const boxAlpha = Math.min(1, Math.max(0, doc.playerBoxOpacity ?? 1))
  if (boxAlpha > 0) {
    ctx.fillStyle = paragon
      ? `rgba(20,28,46,${boxAlpha})`
      : resolveBoxFill(place, doc, boxStyle, boxAlpha)
    ctx.fillRect(slot.x, slot.y, slot.w, clipH)
  }

  const main = player.characters[0]
  const art = images.get(`${slot.playerIndex}:0`)
  if (team) {
    drawTeamPortraits(
      ctx,
      artRect,
      slot,
      team,
      pack,
      images,
      doc,
      tc.slotArtBoost,
      tc.artCoverMultiplier,
      slot.focusX,
      slot.focusY,
    )
  } else if (art && hasCharArt(main)) {
    const eyes = resolvePickEyes(main, pack, art)
    drawCharacterInRect(
      ctx,
      art,
      artRect,
      slot.focusX,
      slot.focusY,
      eyes,
      combinedArtScale(main?.artScale, doc.globalArtScale) * tc.slotArtBoost,
      tc.artCoverMultiplier,
    )
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.font = canvasFont(Math.min(artRect.w, artRect.h) * 0.4, rankFont, '800', 'bebas')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(place), artRect.x + artRect.w / 2, artRect.y + artRect.h / 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  const veilStartRatioRaw =
    eff.playerIdLayout?.veilStartRatio ??
    (effectiveId === 'overlay' ? tc.overlayVeilStartRatio : tc.overlayVeilStartRatioInCard)
  const veilOpacityRaw =
    eff.playerIdLayout?.veilOpacity ??
    (effectiveId === 'overlay' ? tc.overlayVeilOpacity : tc.overlayVeilOpacityInCard)
  const veilStartRatio =
    typeof veilStartRatioRaw === 'number' && Number.isFinite(veilStartRatioRaw)
      ? Math.min(1, Math.max(0, veilStartRatioRaw))
      : effectiveId === 'overlay'
        ? THEME_CONFIG_DEFAULTS.overlayVeilStartRatio
        : THEME_CONFIG_DEFAULTS.overlayVeilStartRatioInCard
  const veilOpacity =
    typeof veilOpacityRaw === 'number' && Number.isFinite(veilOpacityRaw)
      ? Math.min(1, Math.max(0, veilOpacityRaw))
      : effectiveId === 'overlay'
        ? THEME_CONFIG_DEFAULTS.overlayVeilOpacity
        : THEME_CONFIG_DEFAULTS.overlayVeilOpacityInCard
  const veilSpan = effectiveId === 'overlay' ? slot.h : artH
  const veilStart = veilSpan * veilStartRatio
  const veilEnd = veilSpan
  if (
    !paragon &&
    Number.isFinite(slot.x) &&
    Number.isFinite(slot.y) &&
    Number.isFinite(veilStart) &&
    Number.isFinite(veilEnd) &&
    veilEnd > 0
  ) {
    const veil = ctx.createLinearGradient(slot.x, slot.y + veilStart, slot.x, slot.y + veilEnd)
    if (effectiveId === 'overlay') {
      veil.addColorStop(0, 'rgba(8,8,12,0)')
      veil.addColorStop(0.55, `rgba(8,8,12,${veilOpacity * 0.38})`)
      veil.addColorStop(1, `rgba(8,8,12,${veilOpacity})`)
    } else {
      veil.addColorStop(0, 'rgba(8,8,12,0)')
      veil.addColorStop(1, `rgba(8,8,12,${veilOpacity})`)
    }
    ctx.fillStyle = veil
    ctx.fillRect(slot.x, slot.y, slot.w, veilEnd)
  }

  if (team) {
    const handle = formatTwitterHandle(player)
    const labelInset =
      effectiveId === 'overlay' ? slot.nameSize + (handle ? 34 : 16) : 8
    drawTeamMemberLabels(ctx, { ...artRect, h: clipH }, team, playerFont, labelInset)
  }

  ctx.restore()

  if (extraCount > 0) {
    drawExtraCharThumbs(ctx, extraBoxes, slot, extras, place, pack, images, doc)
  }

  if (mainFrame) {
    drawFrameImage(ctx, mainFrame, slot.x, slot.y, slot.w, clipH, slot.radius)
  }

  ctx.fillStyle = accent
  const tl = slot.textLayout
  const rankText = rankLabel(place)
  const slotTextMode = resolveLayoutTextModes(doc).slot
  if (slotTextMode === 'custom' && tl?.rank) {
    drawLayoutTextBox(
      ctx,
      rankText,
      offsetTextBox(slot, tl.rank),
      doc.rankFontId,
      [ar, ag, ab],
      !paragon,
    )
  } else {
    ctx.font = canvasFont(slot.placeSize, rankFont, '800', 'bebas', tokon ? 'italic' : '')
    ctx.textBaseline = 'top'
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    ctx.lineWidth = tokon ? 3 : paragon ? 0 : 4
    const rankX = slot.x + (paragon ? 14 : tokon ? 12 : 16)
    const rankY = slot.y + (paragon ? 10 : tokon ? 8 : 10)
    if (!paragon) {
      ctx.strokeText(rankText, rankX, rankY)
    }
    ctx.fillStyle = paragon ? '#ffffff' : accent
    ctx.fillText(rankText, rankX, rankY)
  }

  const plateY = paragon ? slot.y + artH : slot.y + artH + hangGap
  const useCustomText =
    slotTextMode === 'custom' &&
    (tl?.name || tl?.twitter || tl?.roster || (tl?.extras?.length ?? 0) > 0)
  if (useCustomText) {
    if (tl?.name) {
      drawLayoutTextBox(
        ctx,
        resolveTextBoxContent(tl.name, {
          scope: 'slot',
          doc,
          player,
          charNames,
          showRoster: showExtraCharNames,
          builtInKey: 'name',
        }),
        offsetTextBox(slot, tl.name),
        doc.playerFontId,
        undefined,
        true,
      )
    }
    if (tl?.twitter) {
      drawLayoutTextBox(
        ctx,
        resolveTextBoxContent(tl.twitter, {
          scope: 'slot',
          doc,
          player,
          charNames,
          showRoster: showExtraCharNames,
          builtInKey: 'twitter',
        }),
        offsetTextBox(slot, tl.twitter),
        doc.playerFontId,
      )
    }
    if (tl?.roster) {
      drawLayoutTextBox(
        ctx,
        resolveTextBoxContent(tl.roster, {
          scope: 'slot',
          doc,
          player,
          charNames,
          showRoster: showExtraCharNames,
          builtInKey: 'roster',
        }),
        offsetTextBox(slot, tl.roster),
        doc.playerFontId,
      )
    }
    if (tl?.extras) {
      for (const box of tl.extras) {
        if (box.visible === false) continue
        const text = resolveTextBoxContent(box, {
          scope: 'slot',
          doc,
          player,
          charNames,
          showRoster: showExtraCharNames,
        })
        if (!text) continue
        drawLayoutTextBox(ctx, text, offsetTextBox(slot, box), doc.playerFontId)
      }
    }
  } else if (paragon) {
    drawParagonPlayerIdentity(
      ctx,
      slot,
      player,
      accent,
      plateY,
      paragonNamePlateH,
      paragonTwitterH,
      place,
      playerFont,
    )
  } else if (effectiveId !== 'overlay') {
    drawPlayerIdentity(
      ctx,
      slot,
      player,
      charNames,
      effectiveId,
      plateY,
      plateH,
      accent,
      place,
      playerFont,
      showExtraCharNames,
      twitterH,
      doc.teamMode,
      undefined,
      centerTeamName,
    )
  } else {
    const nameMax = slot.w - 28
    drawPlayerIdentity(
      ctx,
      slot,
      player,
      charNames,
      effectiveId,
      plateY,
      plateH,
      accent,
      place,
      playerFont,
      showExtraCharNames,
      twitterH,
      doc.teamMode,
      nameMax,
      centerTeamName,
    )
  }

  ctx.save()
  if (!paragon) {
    const mainBorderW = resolveBorderWidth(boxStyle, place, 'main')
    const mainBorderOp = resolveBorderOpacity(boxStyle, 'main')
    if (effectiveId === 'hang') {
      roundRect(ctx, slot.x, slot.y, slot.w, artH, slot.radius)
      ctx.strokeStyle = colorWithOpacity(
        place === 1 ? accent : tokon ? `rgba(${ar},${ag},${ab},0.55)` : accent,
        mainBorderOp,
      )
      ctx.lineWidth = mainBorderW
      ctx.stroke()
      ctx.strokeStyle = colorWithOpacity(
        place === 1 ? accent : `rgba(${ar},${ag},${ab},0.45)`,
        mainBorderOp,
      )
      ctx.strokeRect(slot.x, plateY, slot.w, plateH)
    } else {
      roundRect(ctx, slot.x, slot.y, slot.w, slot.h, slot.radius)
      ctx.strokeStyle = colorWithOpacity(
        tokon && place !== 1 ? `rgba(${ar},${ag},${ab},0.55)` : accent,
        mainBorderOp,
      )
      ctx.lineWidth = mainBorderW
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawHeaderPanel(
  ctx: CanvasRenderingContext2D,
  region: HeaderRegion,
  accent: [number, number, number],
) {
  const [ar, ag, ab] = accent
  const bg = region.backgroundColor ?? DEFAULT_HEADER_BG
  const opacity = region.backgroundOpacity ?? 0.55
  const radius = region.borderRadius ?? 0

  ctx.save()
  if (radius > 0) {
    roundRect(ctx, region.x, region.y, region.w, region.h, radius)
    ctx.fillStyle = colorWithOpacity(bg, opacity)
    ctx.fill()
  } else {
    ctx.fillStyle = colorWithOpacity(bg, opacity)
    ctx.fillRect(region.x, region.y, region.w, region.h)
  }

  if (region.borderWidth && region.borderWidth > 0 && region.borderColor) {
    if (radius > 0) {
      roundRect(ctx, region.x, region.y, region.w, region.h, radius)
    } else {
      ctx.beginPath()
      ctx.rect(region.x, region.y, region.w, region.h)
    }
    ctx.strokeStyle = region.borderColor
    ctx.lineWidth = region.borderWidth
    ctx.stroke()
  }

  if (region.accentBarHeight && region.accentBarHeight > 0) {
    ctx.fillStyle = `rgb(${ar},${ag},${ab})`
    ctx.fillRect(region.x, region.y + region.h - region.accentBarHeight, region.w, region.accentBarHeight)
  }
  ctx.restore()
}

export function renderTop8(
  ctx: CanvasRenderingContext2D,
  doc: Top8Doc,
  layout: Layout,
  pack: PackConfig | null,
  images: Map<string, HTMLImageElement>,
  characters: CharacterDef[] = [],
) {
  const { width, height } = layout
  const eff = effectivePosterSettings(doc)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.fillStyle = eff.background
  ctx.fillRect(0, 0, width, height)

  const bg = images.get('bg')
  if (bg) {
    drawCover(ctx, bg, 0, 0, width, height)
    const dim = Math.min(1, Math.max(0, eff.backgroundDim ?? 0.45))
    if (dim > 0) {
      ctx.fillStyle = `rgba(8,8,12,${dim})`
      ctx.fillRect(0, 0, width, height)
    }
  }

  const [ar, ag, ab] = hexToRgb(doc.accent)
  const plainBg =
    layout.theme === 'paragon' ||
    layout.theme === 'animefgc' ||
    layout.theme === 'ebifc' ||
    layout.theme === 'prism'
  if (!bg && !plainBg) {
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.08)`
    ctx.lineWidth = 1
    for (let i = -height; i < width + height; i += 28) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + height, height)
      ctx.stroke()
    }
  }
  if (!bg && layout.theme === 'ebifc') {
    drawEbifcBackdrop(ctx, width, height)
  }
  if (!bg && layout.theme === 'prism') {
    drawPrismBackdrop(ctx, width, height, [ar, ag, ab])
  }

  const isAnimefgc = layout.theme === 'animefgc'
  const isPrism = layout.theme === 'prism'
  const textModes = resolveLayoutTextModes(doc)

  const headerBg = images.get(headerImageKey())
  const headerRegion = doc.customLayout?.header
  if (headerRegion && (headerRegion.backgroundOpacity != null || headerRegion.backgroundColor)) {
    drawHeaderPanel(ctx, headerRegion, [ar, ag, ab])
  }
  if (headerBg && headerRegion) {
    const region = headerRegion
    ctx.save()
    const r = region.borderRadius ?? 12
    roundRect(ctx, region.x, region.y, region.w, region.h, r)
    ctx.clip()
    drawCover(ctx, headerBg, region.x, region.y, region.w, region.h)
    ctx.restore()
  }

  if (!isAnimefgc && !isPrism) {
    drawHeader(
      ctx,
      doc,
      doc.headerStyleId ?? 'compact',
      width,
      [ar, ag, ab],
      images,
      doc.customLayout?.headerTexts,
      doc.customLayout?.header,
      textModes.header,
    )
  }

  const isTokon = layout.theme === 'tokon'
  const isParagon = layout.theme === 'paragon'
  const contentBottom =
    doc.headerStyleId === 'tokon' || doc.headerStyleId === 'paragon'
      ? 920
      : doc.headerStyleId === 'bottom'
        ? 936
        : 1068
  if (isTokon) {
    drawTokonSideBorders(ctx, width, [ar, ag, ab], contentBottom)
  }

  const charNames = new Map(characters.map((c) => [c.codename, c.name]))

  const animefgcListTypography = isAnimefgc
    ? computeAnimefgcListTypography(ctx, doc, layout.slots, doc.playerFontId)
    : undefined

  for (const slot of layout.slots) {
    const player = doc.players[slot.playerIndex] ?? {
      placement: slot.playerIndex + 1,
      tag: '',
      prefix: '',
      twitter: '',
      characters: [],
    }
    renderPlayerSlot(
      ctx,
      slot,
      player,
      doc,
      pack,
      images,
      charNames,
      [ar, ag, ab],
      layout.theme ?? 'default',
      animefgcListTypography,
    )
  }

  if (isAnimefgc || isPrism) {
    drawHeader(
      ctx,
      doc,
      doc.headerStyleId ?? (isPrism ? 'prism' : 'animefgc'),
      width,
      [ar, ag, ab],
      images,
      doc.customLayout?.headerTexts,
      doc.customLayout?.header,
      textModes.header,
    )
  }

  if (doc.showCredits) {
    const creditsBox = doc.customLayout?.creditsText
    if (creditsBox) {
      drawCreditsFromLayout(ctx, doc, creditsBox, isParagon)
    } else {
      ctx.fillStyle =
        isParagon ? 'rgba(26,31,46,0.45)' : isAnimefgc ? 'rgba(247,243,234,0.4)' : 'rgba(247,243,234,0.45)'
      ctx.font = canvasFont(12, doc.titleFontId, '500')
      ctx.textBaseline = 'bottom'
      ctx.textAlign = 'left'
      ctx.fillText(
        'Character assets from StreamHelperAssets  ·  EbifightClub TOP8 Generator',
        16,
        height - 8,
      )
    }
  }

  ctx.restore()
}
