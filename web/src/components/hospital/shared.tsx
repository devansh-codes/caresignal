import type { ReactNode } from 'react'
import { Ctx, footnoteText, useHospitalCtx, type HacView, type HospitalCtx } from './helpers'

export const HospitalProvider = ({ value, children }: { value: HospitalCtx; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
)

export function NotReported({ footnote, what }: { footnote?: string | null; what?: string }) {
  const { measures } = useHospitalCtx()
  const t = footnoteText(footnote, measures)
  return (
    <span className="text-muted" title={t ?? undefined}>
      <span aria-hidden>—</span>
      <span className="sr-only">Not reported by CMS{what ? ` for ${what}` : ''}. {t}</span>
    </span>
  )
}

/** Inline "worse / better than national" text with icon (never color alone). */
export function ComparedBadge({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted">—</span>
  const t = text.toLowerCase()
  if (t.includes('worse'))
    return (
      <span className="inline-flex items-center gap-1 font-medium text-critical">
        <span aria-hidden>▲</span>Worse than national
      </span>
    )
  if (t.includes('better'))
    return (
      <span className="inline-flex items-center gap-1 font-medium text-ok">
        <span aria-hidden>▼</span>Better than national
      </span>
    )
  if (t.includes('no different')) return <span className="text-muted">No different</span>
  return <span className="text-muted">{text}</span>
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-card border border-border bg-surface" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
        {summary}
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-current text-muted transition group-open:rotate-180">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="border-t border-border px-4 py-4 sm:px-5">{children}</div>
    </details>
  )
}

export function ViewToggle({ view, onChange, hasTrajectory }: { view: HacView; onChange: (v: HacView) => void; hasTrajectory: boolean }) {
  const btn = (v: HacView, label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={view === v}
      disabled={disabled}
      onClick={() => onChange(v)}
      className={`rounded px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        view === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div role="radiogroup" aria-label="HAC data view" className="no-print inline-flex rounded-md bg-surface-2 p-0.5">
      {btn('program', 'FY2026 program year')}
      {btn('trajectory', 'Current trajectory', !hasTrajectory)}
    </div>
  )
}
