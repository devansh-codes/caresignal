/**
 * Shared UI primitives. Every frontend page uses these so cards, KPIs, status colors and
 * source attributions look identical everywhere. Extend here; don't fork per page.
 */
import type { ReactNode } from 'react'
import type { Category, HacStatus } from '../../lib/types'
import { CATEGORY_LABEL, STATUS_LABEL } from '../../lib/format'

export function Card({ title, subtitle, action, children, className = '', id }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return (
    <section id={id} className={`rounded-card border border-border bg-surface p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** KPI tile: label, headline value, context line, and a mandatory source note. */
export function KpiTile({ label, value, context, tone = 'neutral', source, info }: {
  label: string; value: ReactNode; context?: ReactNode; tone?: 'neutral' | 'critical' | 'warning' | 'ok'
  source?: string; info?: string
}) {
  const toneCls = { neutral: 'text-ink', critical: 'text-critical', warning: 'text-warning', ok: 'text-ok' }[tone]
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className={`tabular mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {context && <div className="mt-1 text-sm text-muted">{context}</div>}
      {source && <SourceNote>{source}</SourceNote>}
    </div>
  )
}

const STATUS_CLS: Record<HacStatus, string> = {
  penalized: 'bg-critical/10 text-critical ring-critical/30',
  near: 'bg-warning/10 text-warning ring-warning/30',
  clear: 'bg-ok/10 text-ok ring-ok/30',
  exempt: 'bg-surface-2 text-muted ring-border',
  no_score: 'bg-surface-2 text-muted ring-border',
}
export function StatusPill({ status, children }: { status: HacStatus; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_CLS[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children ?? STATUS_LABEL[status]}
    </span>
  )
}

const CAT_CLS: Record<Category, string> = {
  nursing: 'bg-nursing/10 text-nursing ring-nursing/30',
  shared: 'bg-shared/10 text-shared ring-shared/30',
  other: 'bg-other/10 text-other ring-other/30',
}
export function CategoryBadge({ category, title }: { category: Category; title?: string }) {
  return (
    <span title={title} className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${CAT_CLS[category]}`}>
      {CATEGORY_LABEL[category]}
    </span>
  )
}

/** Small "Source: CMS file · period" line. Every number on the site traces to one. */
export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[11px] leading-snug text-muted">Source: {children}</p>
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help normal-case tracking-normal" tabIndex={0} role="button" aria-label={text}>
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current opacity-70"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 10.5h-1.5V7h1.5v4.5ZM8 5.75a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" /></svg>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-md bg-ink px-2.5 py-2 text-xs font-normal text-bg shadow-lg group-hover:block group-focus:block">
        {text}
      </span>
    </span>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="no-print flex gap-2">{actions}</div>}
    </div>
  )
}

/** Loading / error / empty states — designed, never blank. A missing value must never read as normal. */
export function StateView({ kind, message }: { kind: 'loading' | 'error' | 'empty'; message?: string }) {
  if (kind === 'loading')
    return (
      <div role="status" className="flex animate-pulse flex-col gap-3 py-6">
        <div className="h-4 w-1/3 rounded bg-surface-2" />
        <div className="h-24 rounded bg-surface-2" />
        <span className="sr-only">Loading…</span>
      </div>
    )
  return (
    <div role={kind === 'error' ? 'alert' : undefined} className="rounded-card border border-dashed border-border bg-surface-2/50 p-6 text-center text-sm text-muted">
      {message ?? (kind === 'error' ? 'This data could not be loaded.' : 'Not reported by CMS for this hospital.')}
    </div>
  )
}

export function Button({ children, onClick, variant = 'secondary', href, ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary'; href?: string; ariaLabel?: string
}) {
  const cls = variant === 'primary'
    ? 'bg-primary text-primary-ink hover:opacity-90'
    : 'border border-border bg-surface text-ink hover:bg-surface-2'
  const all = `inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${cls}`
  return href ? <a className={all} href={href} aria-label={ariaLabel}>{children}</a>
    : <button type="button" className={all} onClick={onClick} aria-label={ariaLabel}>{children}</button>
}
