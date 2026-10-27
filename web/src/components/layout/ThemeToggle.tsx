import { useState } from 'react'
import { applyTheme, readTheme, type ThemeChoice } from './theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: string }[] = [
  { value: 'light', label: 'Light theme', icon: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z' },
  { value: 'dark', label: 'Dark theme', icon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z' },
  { value: 'system', label: 'Match system theme', icon: 'M4 5h16v10H4zM8 19h8M12 15v4' },
]

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readTheme)
  return (
    <div role="radiogroup" aria-label="Color theme" className="inline-flex rounded-sm border border-rule bg-surface p-0.5">
      {OPTIONS.map((o) => {
        const active = o.value === choice
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => {
              setChoice(o.value)
              applyTheme(o.value)
            }}
            className={`rounded-sm p-1.5 transition ${active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={o.icon} />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
