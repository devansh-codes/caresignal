export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'caresignal-theme'

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable: fall back to system */
  }
  return 'system'
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* storage unavailable: choice lasts for this page view only */
  }
}

// Apply the stored choice as soon as the shell module loads, before first paint of content.
if (typeof document !== 'undefined') applyTheme(readTheme())
