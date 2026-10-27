/**
 * Shared UI primitives in the City Health Dashboard style (docs/STYLE_GUIDE.md): flat white cards,
 * navy headings, royal blue uppercase labels, yellow buttons and arrow links. Every page uses these.
 * Extend here; don't fork per page. Visible text must never contain dashes.
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { Category, HacStatus } from '../../lib/types'
import { CATEGORY_LABEL, STATUS_LABEL } from '../../lib/format'

export function Card({ title, subtitle, action, children, className = '', id }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return (
    <section id={id} className={`rounded-card bg-surface p-5 shadow-card sm:p-8 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-xl font-bold leading-tight text-ink sm:text-2xl">{title}</h2>}
            {subtitle && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-body">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** Small uppercase royal blue label with letter spacing (the reference site's "MEASURING" style). */
export function EyebrowLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`text-xs font-bold uppercase tracking-[0.12em] text-royal dark:text-primary ${className}`}>{children}</div>
}

/** Big light weight number with small uppercase captions above and below. */
export function BigStat({ above, value, below, tone = 'neutral' }: {
  above?: ReactNode; value: ReactNode; below?: ReactNode; tone?: 'neutral' | 'critical' | 'warning' | 'ok'
}) {
  const toneCls = { neutral: 'text-ink', critical: 'text-critical', warning: 'text-warning', ok: 'text-ok' }[tone]
  return (
    <div className="text-center">
      {above && <EyebrowLabel>{above}</EyebrowLabel>}
      <div className={`tabular my-2 text-5xl font-light leading-none sm:text-6xl ${toneCls}`}>{value}</div>
      {below && <EyebrowLabel>{below}</EyebrowLabel>}
    </div>
  )
}

/** KPI tile: label, headline value, context line, and a mandatory source note. */
export function KpiTile({ label, value, context, tone = 'neutral', source, info }: {
  label: string; value: ReactNode; context?: ReactNode; tone?: 'neutral' | 'critical' | 'warning' | 'ok'
  source?: string; info?: string
}) {
  const toneCls = { neutral: 'text-ink', critical: 'text-critical', warning: 'text-warning', ok: 'text-ok' }[tone]
  const bar = { neutral: 'border-t-royal', critical: 'border-t-critical', warning: 'border-t-warning', ok: 'border-t-ok' }[tone]
  return (
    <div className={`rounded-card border-t-4 bg-surface p-5 shadow-card ${bar}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-royal dark:text-primary">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className={`tabular mt-2 text-3xl font-normal leading-tight ${toneCls}`}>{value}</div>
      {context && <div className="mt-1.5 text-sm leading-snug text-body">{context}</div>}
      {source && <SourceNote>{source}</SourceNote>}
    </div>
  )
}

const STATUS_CLS: Record<HacStatus, string> = {
  penalized: 'bg-critical text-white',
  near: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/40',
  clear: 'bg-ok/10 text-ok ring-1 ring-inset ring-ok/40',
  exempt: 'bg-surface-2 text-muted ring-1 ring-inset ring-rule',
  no_score: 'bg-surface-2 text-muted ring-1 ring-inset ring-rule',
}
export function StatusPill({ status, children }: { status: HacStatus; children?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-bold ${STATUS_CLS[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children ?? STATUS_LABEL[status]}
    </span>
  )
}

const CAT_CLS: Record<Category, string> = {
  nursing: 'bg-nursing text-white',
  shared: 'bg-shared text-white',
  other: 'bg-other text-white',
}
export function CategoryBadge({ category, title }: { category: Category; title?: string }) {
  return (
    <span title={title} className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CAT_CLS[category]}`}>
      {CATEGORY_LABEL[category]}
    </span>
  )
}

/** Small "Source: CMS file, period" line. Every number on the site traces to one. */
export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs leading-snug text-muted">Source: {children}</p>
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help normal-case tracking-normal" tabIndex={0} role="button" aria-label={text}>
      <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current opacity-70"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 10.5h-1.5V7h1.5v4.5ZM8 5.75a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" /></svg>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-sm bg-navy px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg group-hover:block group-focus:block">
        {text}
      </span>
    </span>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <EyebrowLabel className="mb-2">{eyebrow}</EyebrowLabel>}
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[2.6rem]">{title}</h1>
        {description && <p className="mt-3 max-w-3xl text-base leading-relaxed text-body sm:text-lg">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Loading, error and empty states: designed, never blank. A missing value must never read as normal. */
export function StateView({ kind, message }: { kind: 'loading' | 'error' | 'empty'; message?: string }) {
  if (kind === 'loading')
    return (
      <div role="status" className="flex animate-pulse flex-col gap-3 py-6">
        <div className="h-4 w-1/3 bg-surface-2" />
        <div className="h-24 bg-surface-2" />
        <span className="sr-only">Loading</span>
      </div>
    )
  return (
    <div role={kind === 'error' ? 'alert' : undefined} className="border border-dashed border-rule bg-surface-2/60 p-6 text-center text-sm text-body">
      {message ?? (kind === 'error' ? 'This data could not be loaded. Please refresh the page.' : 'Not reported by CMS for this hospital.')}
    </div>
  )
}

/**
 * Buttons. 'primary' = yellow with navy text (main call to action), 'secondary' = solid navy,
 * 'ghost' = outlined. Square corners like the reference.
 */
export function Button({ children, onClick, variant = 'secondary', href, ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; href?: string; ariaLabel?: string
}) {
  const cls = {
    primary: 'bg-yellow text-[#112659] hover:brightness-95',
    secondary: 'bg-navy text-navy-ink hover:brightness-125 dark:bg-primary dark:text-primary-ink',
    ghost: 'border border-rule bg-surface text-ink hover:bg-surface-2',
  }[variant]
  const all = `inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-bold transition ${cls}`
  return href ? <a className={all} href={href} aria-label={ariaLabel}>{children}</a>
    : <button type="button" className={all} onClick={onClick} aria-label={ariaLabel}>{children}</button>
}

/** "Read more →" style link: bold navy text, yellow underline, arrow. Pass `to` content as children. */
export function ArrowLink({ href, children, onClick, className = '' }: { href?: string; children: ReactNode; onClick?: () => void; className?: string }) {
  const cls = `group inline-flex items-center gap-2 border-b-2 border-yellow pb-0.5 text-sm font-bold text-ink hover:border-royal ${className}`
  const inner = (
    <>
      {children}
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 transition group-hover:translate-x-0.5"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
    </>
  )
  return href ? <a href={href} className={cls}>{inner}</a> : <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

/** Gray accordion bar with a "SHOW" / "HIDE" chevron, like the reference Metrics Background page. */
export function Accordion({ title, subtitle, children, defaultOpen = false, id }: {
  title: ReactNode; subtitle?: ReactNode; children: ReactNode; defaultOpen?: boolean; id?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panel = useId()
  return (
    <section id={id} className="bg-surface shadow-card">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 bg-surface-2 px-5 py-4 text-left hover:brightness-[0.98]">
        <span className="min-w-0">
          <span className="block text-lg font-medium text-ink sm:text-2xl">{title}</span>
          {subtitle && <span className="mt-0.5 block text-sm text-body">{subtitle}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-center text-[10px] font-bold uppercase tracking-wider text-ink">
          {open ? 'Hide' : 'Show'}
          <svg aria-hidden viewBox="0 0 24 12" className={`mt-0.5 h-3 w-6 transition ${open ? 'rotate-180' : ''}`}><path d="M2 2l10 8 10-8" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </span>
      </button>
      <div id={panel} hidden={!open} className="p-5 sm:p-8">{children}</div>
    </section>
  )
}

/** Underlined tab row (hospital profile style). Controlled: pass active key and onChange. */
export function Tabs<K extends string>({ tabs, active, onChange, label }: {
  tabs: { key: K; label: ReactNode }[]; active: K; onChange: (k: K) => void; label: string
}) {
  return (
    <div role="tablist" aria-label={label} className="no-print flex gap-6 overflow-x-auto border-b border-rule">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={active === t.key} onClick={() => onChange(t.key)}
          className={`-mb-px whitespace-nowrap border-b-[3px] px-0.5 pb-3 pt-2 text-[15px] font-bold transition ${active === t.key ? 'border-yellow text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Full width royal blue band (the reference "What's new" section). */
export function Band({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="bg-royal px-5 py-10 text-white sm:px-10 sm:py-14">
      {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/85">{eyebrow}</div>}
      <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{title}</h2>
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}

/** Numbered step for plain language workflows ("1, 2, 3"). */
export function Step({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow text-lg font-bold text-[#112659]">{n}</span>
      <div>
        <h3 className="text-lg font-bold leading-snug">{title}</h3>
        <div className="mt-1 text-[15px] leading-relaxed opacity-95">{children}</div>
      </div>
    </div>
  )
}
