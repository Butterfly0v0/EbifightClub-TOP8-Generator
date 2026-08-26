const STARTGG_KEY = 'ebi-startgg-token'
const CHALLONGE_KEY = 'ebi-challonge-api-key'
const PARRYGG_KEY = 'ebi-parrygg-api-key'

export function getStartggToken(): string {
  return localStorage.getItem(STARTGG_KEY) ?? ''
}

export function setStartggToken(token: string) {
  if (token) localStorage.setItem(STARTGG_KEY, token)
  else localStorage.removeItem(STARTGG_KEY)
}

export function getChallongeApiKey(): string {
  return localStorage.getItem(CHALLONGE_KEY) ?? ''
}

export function setChallongeApiKey(key: string) {
  if (key) localStorage.setItem(CHALLONGE_KEY, key)
  else localStorage.removeItem(CHALLONGE_KEY)
}

export function getParryggApiKey(): string {
  return localStorage.getItem(PARRYGG_KEY) ?? ''
}

export function setParryggApiKey(key: string) {
  if (key) localStorage.setItem(PARRYGG_KEY, key)
  else localStorage.removeItem(PARRYGG_KEY)
}
