export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'caresignal-theme'

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable: fall back to the light default */
  }
  return 'light'
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  // 'dark-system' only turns dark when the OS prefers dark (see index.css); light is the default.
  root.setAttribute('data-theme', choice === 'system' ? 'dark-system' : choice)
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* storage unavailable: choice lasts for this page view only */
  }
}

// Apply the stored choice as soon as the shell module loads, before first paint of content.
if (typeof document !== 'undefined') applyTheme(readTheme())
