import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import type { Connect, PreviewServer, ViteDevServer } from 'vite'
import {
  buildTop8DocFromApiRequest,
  validateTop8ApiRequest,
  type Top8ApiJobMeta,
} from '../src/lib/top8Api.ts'

const JOBS_DIR = path.resolve('.api-jobs')
mkdirSync(JOBS_DIR, { recursive: true })

const API_KEY = process.env.TOP8_API_KEY?.trim() || ''

type JobRecord = Top8ApiJobMeta & {
  pngPath?: string
}

function jobMetaPath(id: string) {
  return path.join(JOBS_DIR, `${id}.json`)
}

function jobPngPath(id: string) {
  return path.join(JOBS_DIR, `${id}.png`)
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

function json(res: Connect.ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function text(res: Connect.ServerResponse, status: number, body: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(body)
}

function checkApiKey(req: Connect.IncomingMessage): boolean {
  if (!API_KEY) return true
  const auth = req.headers.authorization ?? ''
  if (auth === `Bearer ${API_KEY}`) return true
  const headerKey = req.headers['x-api-key']
  if (typeof headerKey === 'string' && headerKey === API_KEY) return true
  return false
}

function newJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function loadJob(id: string): JobRecord | null {
  const file = jobMetaPath(id)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as JobRecord
  } catch {
    return null
  }
}

function saveJob(job: JobRecord) {
  writeFileSync(jobMetaPath(job.id), JSON.stringify(job, null, 2))
}

function requestOrigin(req: Connect.IncomingMessage, fallbackPort: number): string {
  const host = req.headers.host || `127.0.0.1:${fallbackPort}`
  const proto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto']
      : 'http'
  return `${proto}://${host}`
}

async function renderJobWithPlaywright(origin: string, jobId: string): Promise<Buffer> {
  let chromium: typeof import('playwright').chromium
  try {
    ;({ chromium } = await import('playwright'))
  } catch {
    throw new Error(
      '未安装 playwright。请执行：npm i -D playwright && npx playwright install chromium',
    )
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  })
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    })
    const url = `${origin}/export-api.html?job=${encodeURIComponent(jobId)}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(
      () =>
        Boolean((window as unknown as { __TOP8_RENDER_DONE__?: boolean }).__TOP8_RENDER_DONE__) ||
        Boolean((window as unknown as { __TOP8_RENDER_ERROR__?: string }).__TOP8_RENDER_ERROR__),
      { timeout: 120000 },
    )
    const err = await page.evaluate(
      () => (window as unknown as { __TOP8_RENDER_ERROR__?: string }).__TOP8_RENDER_ERROR__ ?? '',
    )
    if (err) throw new Error(err)

    const pngFile = jobPngPath(jobId)
    // 页面会把结果 POST 回 complete；稍等落盘
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      if (existsSync(pngFile)) {
        return readFileSync(pngFile)
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error('渲染完成但未收到 PNG 文件')
  } finally {
    await browser.close()
  }
}

function cleanupJobFiles(id: string) {
  for (const p of [jobMetaPath(id), jobPngPath(id)]) {
    try {
      if (existsSync(p)) unlinkSync(p)
    } catch {
      /* ignore */
    }
  }
}

export function attachTop8RenderApi(
  server: ViteDevServer | PreviewServer,
  fallbackPort = 5173,
) {
  server.middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''

    // GET /api/v1/top8/layouts
    if (url === '/api/v1/top8/layouts' && req.method === 'GET') {
      void import('../src/lib/layouts.ts').then(({ LAYOUT_LIST }) => {
        json(
          res,
          200,
          LAYOUT_LIST.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            theme: l.theme ?? 'default',
          })),
        )
      })
      return
    }

    // GET /api/v1/top8/jobs/:id
    const jobGet = url.match(/^\/api\/v1\/top8\/jobs\/([^/]+)$/)
    if (jobGet && req.method === 'GET') {
      const id = decodeURIComponent(jobGet[1])
      const job = loadJob(id)
      if (!job) {
        text(res, 404, '任务不存在')
        return
      }
      json(res, 200, {
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        error: job.error,
        doc: job.doc,
      })
      return
    }

    // POST /api/v1/top8/jobs/:id/complete
    const jobComplete = url.match(/^\/api\/v1\/top8\/jobs\/([^/]+)\/complete$/)
    if (jobComplete && req.method === 'POST') {
      void (async () => {
        try {
          const id = decodeURIComponent(jobComplete[1])
          const job = loadJob(id)
          if (!job) {
            text(res, 404, '任务不存在')
            return
          }
          const body = (await readJsonBody(req)) as { dataUrl?: string; error?: string }
          if (body.error) {
            job.status = 'error'
            job.error = body.error
            saveJob(job)
            json(res, 200, { ok: false })
            return
          }
          const dataUrl = body.dataUrl?.trim()
          if (!dataUrl?.startsWith('data:image/png;base64,')) {
            text(res, 400, '需要 data:image/png;base64,...')
            return
          }
          const b64 = dataUrl.slice('data:image/png;base64,'.length)
          const pngPath = jobPngPath(id)
          writeFileSync(pngPath, Buffer.from(b64, 'base64'))
          job.status = 'done'
          job.pngPath = pngPath
          job.error = undefined
          saveJob(job)
          json(res, 200, { ok: true })
        } catch (err: unknown) {
          text(res, 500, err instanceof Error ? err.message : 'complete 失败')
        }
      })()
      return
    }

    // POST /api/v1/top8/render
    if (url === '/api/v1/top8/render' && req.method === 'POST') {
      void (async () => {
        try {
          if (!checkApiKey(req)) {
            text(res, 401, 'Unauthorized：请设置 Authorization: Bearer <TOP8_API_KEY>')
            return
          }
          const body = await readJsonBody(req)
          const validated = validateTop8ApiRequest(body)
          if (!validated.ok) {
            text(res, 400, validated.error)
            return
          }
          const doc = buildTop8DocFromApiRequest(validated.req)
          const id = newJobId()
          const job: JobRecord = {
            id,
            status: 'rendering',
            createdAt: new Date().toISOString(),
            doc,
          }
          saveJob(job)

          const origin = requestOrigin(req, fallbackPort)
          try {
            const png = await renderJobWithPlaywright(origin, id)
            res.statusCode = 200
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Content-Disposition', `inline; filename="top8-${id}.png"`)
            res.setHeader('X-Top8-Job-Id', id)
            res.end(png)
          } catch (err: unknown) {
            job.status = 'error'
            job.error = err instanceof Error ? err.message : String(err)
            saveJob(job)
            text(res, 502, job.error)
          } finally {
            // 短暂保留便于排查；成功后也可清理
            setTimeout(() => cleanupJobFiles(id), 60_000)
          }
        } catch (err: unknown) {
          text(res, 500, err instanceof Error ? err.message : '渲染失败')
        }
      })()
      return
    }

    // POST /api/v1/top8/prepare — 只生成任务，不自动开浏览器（调试用）
    if (url === '/api/v1/top8/prepare' && req.method === 'POST') {
      void (async () => {
        try {
          if (!checkApiKey(req)) {
            text(res, 401, 'Unauthorized')
            return
          }
          const body = await readJsonBody(req)
          const validated = validateTop8ApiRequest(body)
          if (!validated.ok) {
            text(res, 400, validated.error)
            return
          }
          const doc = buildTop8DocFromApiRequest(validated.req)
          const id = newJobId()
          saveJob({
            id,
            status: 'queued',
            createdAt: new Date().toISOString(),
            doc,
          })
          const origin = requestOrigin(req, fallbackPort)
          json(res, 200, {
            jobId: id,
            exportUrl: `${origin}/export-api.html?job=${encodeURIComponent(id)}`,
            jobUrl: `${origin}/api/v1/top8/jobs/${encodeURIComponent(id)}`,
          })
        } catch (err: unknown) {
          text(res, 500, err instanceof Error ? err.message : 'prepare 失败')
        }
      })()
      return
    }

    next()
  })
}
