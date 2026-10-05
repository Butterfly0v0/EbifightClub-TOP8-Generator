import type { CharacterDef, PlayerSlot, Top8Doc } from '../types'

const RANK_MEDAL: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

function ordinalLabel(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function playerDisplayName(player: PlayerSlot): string {
  const tag = player.tag.trim()
  const prefix = player.prefix.trim()
  if (prefix && tag) return `${prefix} | ${tag}`
  return tag || prefix || 'TBD'
}

function formatTwitter(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return t.startsWith('@') ? t : `@${t}`
}

function characterNamesForTweet(
  player: PlayerSlot,
  charNames: Map<string, string>,
): string {
  const names = player.characters
    .filter((c) => c.codename || c.customImageDataUrl)
    .map((c) => {
      if (c.codename) return charNames.get(c.codename) ?? c.codename
      return 'Custom'
    })
    .filter(Boolean)
  return names.join('/')
}

/** 参照炸虾周赛 TOP8 推文模板生成纯文本 */
export function buildTop8TweetText(
  doc: Top8Doc,
  characters: CharacterDef[] = [],
): string {
  const charNames = new Map(characters.map((c) => [c.codename, c.name]))
  const title = doc.tournamentName.trim() || 'TOP8'
  const header = title.toUpperCase().endsWith('TOP8')
    ? `🏆${title}`
    : `🏆${title} TOP8`

  const lines = [...doc.players]
    .filter((p) => p.tag.trim() || p.prefix.trim())
    .sort((a, b) => a.placement - b.placement)
    .map((player) => {
      const medal = RANK_MEDAL[player.placement] ?? ''
      const rank = ordinalLabel(player.placement)
      const name = playerDisplayName(player)
      const twitter = formatTwitter(player.twitter)
      const twitterPart = twitter ? ` ${twitter}` : ''
      if (doc.teamMode && player.members?.length) {
        const roster = player.members
          .filter((member) => member.tag.trim() || member.characters.some((c) => c.codename || c.customImageDataUrl))
          .map((member) => {
            const who = [member.prefix.trim(), member.tag.trim()].filter(Boolean).join(' | ') || 'TBD'
            const charName = characterNamesForTweet(
              { ...player, characters: member.characters },
              charNames,
            )
            return charName ? `${who} (${charName})` : who
          })
          .join(' / ')
        return `${medal}${rank}: ${name}${roster ? ` — ${roster}` : ''}${twitterPart}`
      }
      const charName = characterNamesForTweet(player, charNames)
      const charPart = charName ? `(${charName})` : ''
      return `${medal}${rank}: ${name}${charPart}${twitterPart}`
    })

  return [header, ...lines].join('\n')
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

export function downloadTweetText(text: string, tournamentName: string): void {
  const safe = (tournamentName || 'top8').replace(/[\\/:*?"<>|]+/g, '_')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safe}-TOP8-tweet.txt`
  link.click()
  URL.revokeObjectURL(url)
}
