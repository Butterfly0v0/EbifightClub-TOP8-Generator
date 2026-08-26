import { copyFileSync, createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import type { Connect, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { parseParryStandingsHtml } from './src/lib/parryParse.ts'
import { attachTop8RenderApi } from './server/top8ApiMiddleware.ts'

const SHA_PREFIX = '/api/sha/'
const CACHE_DIR = path.resolve('.sha-cache')
const USER_ASSETS_DIR = path.resolve('public/user-assets')
const SAVES_DIR = path.resolve('saves')
mkdirSync(CACHE_DIR, { recursive: true })
mkdirSync(USER_ASSETS_DIR, { recursive: true })
mkdirSync(SAVES_DIR, { recursive: true })

function sanitizeGameCode(code: string): string {
  const s = String(code || 'shared')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 64)
  return s || 'shared'
}

function cacheFile(rel: string): string {
  const safe = rel.replace(/^\/+/, '').replace(/\\/g, '/')
  if (safe.includes('..')) throw new Error('invalid cache path')
  return path.join(CACHE_DIR, ...safe.split('/'))
}

function legacyCacheFile(rel: string): string {
  return path.join(CACHE_DIR, rel.replaceAll('/', '__'))
}

function resolveCacheFile(rel: string): string | null {
  const nested = cacheFile(rel)
  if (existsSync(nested)) return nested
  const legacy = legacyCacheFile(rel)
  if (existsSync(legacy)) {
    mkdirSync(path.dirname(nested), { recursive: true })
    copyFileSync(legacy, nested)
    return nested
  }
  return null
}

function saveGameDir(gameCode: string): string {
  const dir = path.join(SAVES_DIR, sanitizeGameCode(gameCode))
  mkdirSync(dir, { recursive: true })
  return dir
}

function guessType(rel: string): string {
  if (rel.endsWith('.json')) return 'application/json; charset=utf-8'
  if (rel.endsWith('.png')) return 'image/png'
  if (rel.endsWith('.jpg') || rel.endsWith('.jpeg')) return 'image/jpeg'
  if (rel.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

async function fetchFirst(urls: string[]): Promise<{ type: string; body: Buffer } | null> {
  for (const url of urls) {
    try {
      const upstream = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(25000),
      })
      if (upstream.status >= 300 && upstream.status < 400) continue
      if (!upstream.ok) continue
      const body = Buffer.from(await upstream.arrayBuffer())
      const type = upstream.headers.get('content-type') ?? guessType(url)
      return { type, body }
    } catch {
      // try the next source
    }
  }
  return null
}

const inflight = new Map<string, Promise<{ type: string; body: Buffer } | null>>()

function fetchAsset(rel: string) {
  const hit = inflight.get(rel)
  if (hit) return hit
  const sources = [
    `https://gh-proxy.com/https://raw.githubusercontent.com/joaorb64/StreamHelperAssets/main/${rel}`,
    `https://cdn.jsdelivr.net/gh/joaorb64/StreamHelperAssets@main/${rel}`,
    `https://ghfast.top/https://raw.githubusercontent.com/joaorb64/StreamHelperAssets/main/${rel}`,
    `https://raw.githubusercontent.com/joaorb64/StreamHelperAssets/main/${rel}`,
  ]
  const job = fetchFirst(sources).finally(() => inflight.delete(rel))
  inflight.set(rel, job)
  return job
}

function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function attachAssetProxy(server: { middlewares: Connect.Server }) {
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith(SHA_PREFIX)) {
      next()
      return
    }
    const rel = decodeURIComponent(req.url.slice(SHA_PREFIX.length).split('?')[0])
    const cached = resolveCacheFile(rel)
    if (cached) {
      res.statusCode = 200
      res.setHeader('Content-Type', guessType(rel))
      res.setHeader('Cache-Control', 'public, max-age=86400')
      createReadStream(cached).pipe(res)
      return
    }

    void fetchAsset(rel)
      .then((result) => {
        if (!result) {
          res.statusCode = 502
          res.end('Failed to fetch StreamHelperAssets')
          return
        }
        const file = cacheFile(rel)
        mkdirSync(path.dirname(file), { recursive: true })
        writeFileSync(file, result.body)
        res.statusCode = 200
        res.setHeader('Content-Type', result.type)
        res.setHeader('Cache-Control', 'public, max-age=86400')
        res.end(result.body)
      })
      .catch(() => {
        res.statusCode = 502
        res.end('Failed to fetch StreamHelperAssets')
      })
  })
}

/** 抓取公开 standings 页并解析 Remix loader 数据（无需 API key） */
function attachParryImport(server: ViteDevServer | PreviewServer) {
  server.middlewares.use('/api/parrygg/import', (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    void (async () => {
      try {
        const body = (await readJsonBody(req)) as { url?: string }
        const url = body.url?.trim()
        if (!url || !/^https:\/\/(www\.)?parry\.gg\//i.test(url)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('请提供有效的 parry.gg standings 链接')
          return
        }
        const upstream = await fetch(url, {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent': 'EbifightClub-TOP8-Generator/1.0',
          },
          signal: AbortSignal.timeout(30000),
          redirect: 'follow',
        })
        if (!upstream.ok) {
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(`无法打开 parry.gg 页面（${upstream.status}）`)
          return
        }
        const html = await upstream.text()
        const parsed = parseParryStandingsHtml(html)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(parsed))
      } catch (err: unknown) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(err instanceof Error ? err.message : 'parry.gg 导入失败')
      }
    })()
  })
}

function attachUserAssetsApi(server: { middlewares: Connect.Server }) {
  server.middlewares.use('/api/user-assets/upload', (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    void (async () => {
      try {
        const body = (await readJsonBody(req)) as {
          data?: string
          mime?: string
          prefix?: string
          gameCode?: string
        }
        const data = body.data?.trim()
        if (!data || !data.startsWith('data:')) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('无效的图片数据')
          return
        }
        const comma = data.indexOf(',')
        const header = data.slice(0, comma)
        const b64 = data.slice(comma + 1)
        const mimeMatch = header.match(/data:([^;]+)/)
        const mime = body.mime ?? mimeMatch?.[1] ?? 'image/jpeg'
        const ext =
          mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
        const safePrefix = (body.prefix ?? 'asset').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 32)
        const gameDir = path.join(USER_ASSETS_DIR, sanitizeGameCode(body.gameCode ?? 'shared'))
        mkdirSync(gameDir, { recursive: true })
        const filename = `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const filePath = path.join(gameDir, filename)
        writeFileSync(filePath, Buffer.from(b64, 'base64'))
        const gameFolder = sanitizeGameCode(body.gameCode ?? 'shared')
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ url: `/user-assets/${gameFolder}/${filename}` }))
      } catch (err: unknown) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(err instanceof Error ? err.message : '上传失败')
      }
    })()
  })
}

function attachSavesApi(server: { middlewares: Connect.Server }) {
  server.middlewares.use((req, res, next) => {
    const match = req.url?.match(/^\/api\/saves\/([^/]+)\/(doc|layouts)(?:\?.*)?$/)
    if (!match) {
      next()
      return
    }
    const gameCode = sanitizeGameCode(decodeURIComponent(match[1]))
    const kind = match[2]
    const file = path.join(saveGameDir(gameCode), kind === 'doc' ? 'doc.json' : 'layouts.json')

    if (req.method === 'GET') {
      if (!existsSync(file)) {
        res.statusCode = 404
        res.end()
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      createReadStream(file).pipe(res)
      return
    }

    if (req.method === 'POST') {
      void (async () => {
        try {
          const body = await readJsonBody(req)
          writeFileSync(file, JSON.stringify(body, null, 2))
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true }))
        } catch (err: unknown) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(err instanceof Error ? err.message : '保存失败')
        }
      })()
      return
    }

    next()
  })
}

function attachDevApis(server: ViteDevServer | PreviewServer) {
  attachAssetProxy(server)
  attachParryImport(server)
  attachUserAssetsApi(server)
  attachSavesApi(server)
  attachTop8RenderApi(server, 5173)
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'tournament-import-apis',
      configureServer: attachDevApis,
      configurePreviewServer: attachDevApis,
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api/startgg': {
        target: 'https://api.start.gg',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/startgg/, '/gql/alpha'),
      },
      '/api/challonge': {
        target: 'https://api.challonge.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/challonge/, ''),
      },
    },
  },
})
