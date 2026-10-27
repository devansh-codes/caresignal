/**
 * Local building blocks for the hospital page, styled after the City Health Dashboard:
 * flat white panels, uppercase blue eyebrows, big light numbers, gray "SHOW" accordions,
 * yellow and navy square buttons. Shared primitives live in components/ui; these are page specific.
 */
import { useId, useState, type ReactNode } from 'react'
import { Ctx, footnoteText, useHospitalCtx, type HacView, type HospitalCtx } from './helpers'

export const HospitalProvider = ({ value, children }: { value: HospitalCtx; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
)

export function NotReported({ footnote, what }: { footnote?: string | null; what?: string }) {
  const { measures } = useHospitalCtx()
  const t = footnoteText(footnote, measures)
  return (
    <span className="text-muted" title={t ?? 'Not reported by CMS'}>
      N/A
      <span className="sr-only">, not reported by CMS{what ? ` for ${what}` : ''}. {t}</span>
    </span>
  )
}

/** Plain "better / worse than national" text with an icon, so color is never the only cue. */
export function ComparedBadge({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted">N/A</span>
  const t = text.toLowerCase()
  if (t.includes('worse'))
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-critical">
        <span aria-hidden>▲</span>Worse than national
      </span>
    )
  if (t.includes('better'))
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-ok">
        <span aria-hidden>▼</span>Better than national
      </span>
    )
  if (t.includes('no different')) return <span className="text-muted">About the same as national</span>
  return <span className="text-muted">{text}</span>
}

/** Flat white panel with generous padding (reference: white content blocks on a gray page). */
export function Panel({ children, className = '', id, labelledBy }: { children: ReactNode; className?: string; id?: string; labelledBy?: string }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`rounded-sm bg-surface p-5 sm:p-8 ${className}`}>
      {children}
    </section>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{children}</div>
}

/** Panel heading with an optional "What this means" helper line underneath. */
export function PanelTitle({ id, title, helper, action }: { id?: string; title: ReactNode; helper?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-3xl">
        <h3 id={id} className="text-xl font-bold text-ink sm:text-2xl">{title}</h3>
        {helper && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">What this means: </span>
            {helper}
          </p>
        )}
      </div>
      {action && <div className="no-print shrink-0">{action}</div>}
    </header>
  )
}

/** Numbered workflow step: "1  Where this hospital stands". */
export function Step({ n, id, title, intro }: { n: number; id: string; title: string; intro: string }) {
  return (
    <div className="mb-4 mt-2 flex items-start gap-4">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#FECA71] text-lg font-bold text-ink">{n}</span>
      <div>
        <h2 id={id} className="text-2xl font-bold text-ink sm:text-[28px]">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-[15px] text-muted">{intro}</p>
      </div>
    </div>
  )
}

/** Big light number with uppercase captions above and below (reference stat block). */
export function BigStat({ caption, value, sub, tone = 'ink' }: { caption: string; value: ReactNode; sub?: ReactNode; tone?: 'ink' | 'critical' | 'warning' | 'ok' | 'muted' }) {
  const cls = { ink: 'text-ink', critical: 'text-critical', warning: 'text-warning', ok: 'text-ok', muted: 'text-muted' }[tone]
  return (
    <div className="flex flex-col items-start">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{caption}</div>
      <div className={`tabular mt-1 text-4xl font-light leading-tight sm:text-5xl ${cls}`}>{value}</div>
      {sub && <div className="mt-1.5 text-sm leading-snug text-muted">{sub}</div>}
    </div>
  )
}

/** Gray full width bar with a "SHOW / HIDE" toggle, used for detail tables. */
export function Accordion({ title, children, defaultOpen = false }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="rounded-sm bg-surface-2 shadow-[0_1px_2px_rgba(17,38,89,0.12)] print:hidden">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
        >
          <span className="text-lg font-medium text-ink sm:text-xl">{title}</span>
          <span className="flex shrink-0 flex-col items-center text-[10px] font-bold uppercase tracking-wider text-ink">
            {open ? 'Hide' : 'Show'}
            <svg aria-hidden viewBox="0 0 24 12" className={`mt-0.5 h-3 w-6 transition ${open ? 'rotate-180' : ''}`}>
              <path d="M2 2l10 8 10-8" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
        </button>
      </h3>
      {open && (
        <div id={id} className="bg-surface px-4 py-5 sm:px-5">
          {children}
        </div>
      )}
    </div>
  )
}

export function YellowButton({ children, onClick, ariaLabel }: { children: ReactNode; onClick: () => void; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel}
      className="inline-flex items-center gap-2 rounded-none bg-[#FECA71] px-5 py-2.5 text-[15px] font-bold text-[#112659] transition hover:brightness-95">
      {children}
    </button>
  )
}
export function NavyButton({ children, onClick, ariaLabel }: { children: ReactNode; onClick: () => void; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel}
      className="inline-flex items-center gap-2 rounded-none bg-[#112659] px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-[#2F4F9E]">
      {children}
    </button>
  )
}

/** Small source line in plain words. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-xs leading-snug text-muted">Source: {children}</p>
}

/** Note box for approximations and caveats. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-4 border-l-4 border-[#FECA71] bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">{children}</p>
}

export function ViewToggle({ view, onChange, hasTrajectory }: { view: HacView; onChange: (v: HacView) => void; hasTrajectory: boolean }) {
  const btn = (v: HacView, label: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={view === v}
      disabled={disabled}
      onClick={() => onChange(v)}
      className={`px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        view === v ? 'bg-[#112659] text-white' : 'bg-surface text-ink hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Which data to show" className="no-print inline-flex border border-[#112659]">
      {btn('program', 'Official FY2026 score')}
      {btn('trajectory', 'Latest data (preview)', !hasTrajectory)}
    </div>
  )
}
