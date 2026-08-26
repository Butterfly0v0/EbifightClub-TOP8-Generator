export type UiTheme = 'dark' | 'light'

const THEME_KEY = 'ebi-ui-theme'

export function getStoredTheme(): UiTheme | null {
  const raw = localStorage.getItem(THEME_KEY)
  if (raw === 'light' || raw === 'dark') return raw
  return null
}

export function resolveInitialTheme(): UiTheme {
  const stored = getStoredTheme()
  if (stored) return stored
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

export function applyTheme(theme: UiTheme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function setStoredTheme(theme: UiTheme) {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}
