type ParryPath = {
  id?: string
  type?: number
  name?: string
  slug?: string
  startTime?: { seconds?: number }
}

type ParryUser = {
  gamerTag?: string
  firstName?: string
  lastName?: string
  sponsorName?: string
}

export type ParryParsedResult = {
  placement?: {
    placement?: number
    eventEntrant?: {
      name?: string
      entrant?: { usersList?: ParryUser[] }
    }
  }
}

export type ParryParsedImport = {
  tournamentName: string
  eventName: string
  date: string
  videogameName: string
  numEntrants: number
  results: ParryParsedResult[]
}

function formatUnixDate(seconds: number | undefined): string {
  if (!seconds) return ''
  return new Date(seconds * 1000).toISOString().slice(0, 10)
}

function extractRemixContext(html: string): unknown {
  const patterns = [
    /window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/,
    /window\.__remixContext\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:window\.|<\/script>)/,
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (!match) continue
    try {
      return JSON.parse(match[1])
    } catch {
      // try next
    }
  }
  throw new Error('无法解析 parry.gg 页面数据，请确认链接为已完赛的 standings 页面')
}

type LoaderBlob = {
  results?: ParryParsedResult[]
  breadcrumbHierarchy?: { pathsList?: ParryPath[] }
}

function findStandingsLoader(ctx: unknown): LoaderBlob | null {
  const loaderData = (ctx as { state?: { loaderData?: Record<string, LoaderBlob> } })?.state
    ?.loaderData
  if (!loaderData) return null

  // 优先匹配 standings 路由
  for (const [key, value] of Object.entries(loaderData)) {
    if (/standings/i.test(key) && Array.isArray(value?.results) && value.results.length > 0) {
      return value
    }
  }
  // 回退：任意带 results 的 loader
  for (const value of Object.values(loaderData)) {
    if (Array.isArray(value?.results) && value.results.length > 0) return value
  }
  return null
}

export function parseParryStandingsHtml(html: string): ParryParsedImport {
  const ctx = extractRemixContext(html)
  const loader = findStandingsLoader(ctx)
  const results = loader?.results ?? []
  if (results.length === 0) throw new Error('该 parry.gg 页面没有 standings 数据')

  const paths = loader?.breadcrumbHierarchy?.pathsList ?? []
  const tournament = paths.find((p) => p.type === 0)
  const event = paths.find((p) => p.type === 1)

  return {
    tournamentName: tournament?.name ?? 'parry.gg Tournament',
    eventName: event?.name ?? tournament?.name ?? 'Event',
    date: formatUnixDate(event?.startTime?.seconds ?? tournament?.startTime?.seconds),
    videogameName: event?.name ?? '',
    numEntrants: results.length,
    results,
  }
}
