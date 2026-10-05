import { useEffect, useMemo, useState } from 'react'
import {
  fetchCatalog,
  fetchGameCharacters,
  fetchPackConfig,
} from './lib/assets'
import { waitForFonts } from './lib/fonts'
import { resolveLayout } from './lib/layoutMetrics'
import { resolveDocLayout } from './lib/layouts'
import { collectImages, renderTop8 } from './lib/render'
import type { Catalog, CharacterDef, PackConfig, Top8Doc } from './types'

type JobPayload = {
  id: string
  doc: Top8Doc
}

/**
 * 无 UI 导出页：供外部 API 用无头浏览器打开，渲染后回传 PNG。
 * URL: /export-api.html?job=<id>
 */
export default function ExportApiApp() {
  const [message, setMessage] = useState('准备渲染…')
  const [error, setError] = useState('')

  const jobId = useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    return q.get('job')?.trim() ?? ''
  }, [])

  useEffect(() => {
    if (!jobId) {
      setError('缺少 job 参数')
      return
    }

    let cancelled = false

    const run = async () => {
      setMessage('读取任务…')
      const jobRes = await fetch(`/api/v1/top8/jobs/${encodeURIComponent(jobId)}`)
      if (!jobRes.ok) {
        throw new Error(`无法读取任务（${jobRes.status}）`)
      }
      const job = (await jobRes.json()) as JobPayload
      const doc = job.doc
      if (cancelled) return

      setMessage('加载素材目录…')
      const catalog: Catalog = await fetchCatalog()
      const game = catalog[doc.gameCode]
      if (!game) throw new Error(`未知游戏：${doc.gameCode}`)

      const packId = game.packs.some((p) => p.id === doc.packId)
        ? doc.packId
        : (game.packs.find((p) => p.id === 'full')?.id ?? game.packs[0]?.id ?? 'full')

      setMessage('加载角色与素材包…')
      const [characters, pack]: [CharacterDef[], PackConfig] = await Promise.all([
        fetchGameCharacters(game.code),
        fetchPackConfig(game, packId),
      ])
      if (cancelled) return

      const baseLayout = resolveDocLayout(doc)
      const layout = resolveLayout(baseLayout, doc.headerStyleId)

      setMessage('加载字体与图片…')
      const fontSample = [
        doc.tournamentName,
        doc.subtitle,
        ...doc.players.map((p) => [p.tag, p.prefix].filter(Boolean).join(' ')),
      ]
        .filter(Boolean)
        .join(' ')
      const [, images] = await Promise.all([
        waitForFonts([doc.titleFontId, doc.playerFontId, doc.rankFontId], fontSample),
        collectImages({ ...doc, packId }, game, pack, baseLayout),
      ])
      if (cancelled) return

      setMessage('绘制海报…')
      const canvas = document.createElement('canvas')
      canvas.width = layout.width
      canvas.height = layout.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建 Canvas')
      renderTop8(ctx, { ...doc, packId }, layout, pack, images, characters)

      const dataUrl = canvas.toDataURL('image/png')
      setMessage('回传结果…')
      const complete = await fetch(`/api/v1/top8/jobs/${encodeURIComponent(jobId)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      if (!complete.ok) {
        const text = await complete.text()
        throw new Error(text || `回传失败（${complete.status}）`)
      }

      ;(window as unknown as { __TOP8_RENDER_DONE__?: boolean }).__TOP8_RENDER_DONE__ = true
      setMessage('完成')
    }

    void run().catch((e: unknown) => {
      if (cancelled) return
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      void fetch(`/api/v1/top8/jobs/${encodeURIComponent(jobId)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: msg }),
      }).catch(() => {})
      ;(window as unknown as { __TOP8_RENDER_ERROR__?: string }).__TOP8_RENDER_ERROR__ = msg
    })

    return () => {
      cancelled = true
    }
  }, [jobId])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, color: '#e8e6e3' }}>
      <h1 style={{ fontSize: 16, margin: 0 }}>TOP8 API Render</h1>
      <p style={{ opacity: 0.75 }}>{message}</p>
      {error ? <p style={{ color: '#ff6b6b' }}>{error}</p> : null}
    </div>
  )
}
