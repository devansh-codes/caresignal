/**
 * Page building blocks for the National picture, How it works, About the data and Downloads pages,
 * styled after cityhealthdashboard.com: flat white panels, navy headings, uppercase royal eyebrows,
 * big light stat numbers, yellow buttons and arrow links, gray accordion bars.
 * Colors come from the shared tokens; the yellow accent reads --yellow with a fallback.
 */
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const ACCENT = 'rgb(var(--yellow, 254 202 113))'

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{children}</p>
}

/** Page opener: eyebrow, big heading, a "What this page tells you" line, optional buttons. */
export function PageIntro({ eyebrow, title, lead, tells, actions }: {
  eyebrow: string; title: string; lead?: ReactNode; tells: ReactNode; actions?: ReactNode
}) {
  return (
    <header className="mb-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-[2.5rem] sm:leading-tight">{title}</h1>
      {lead && <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">{lead}</p>}
      <div className="mt-5 max-w-3xl border-l-4 bg-surface px-5 py-4" style={{ borderColor: ACCENT }}>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink">What this page tells you</p>
        <div className="mt-1 text-[15px] leading-relaxed text-muted">{tells}</div>
      </div>
      {actions && <div className="no-print mt-6 flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}

/** Flat white panel with generous padding, like the reference cards. */
export function Panel({ title, eyebrow, intro, children, id, className = '' }: {
  title?: ReactNode; eyebrow?: string; intro?: ReactNode; children: ReactNode; id?: string; className?: string
}) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-[2px] bg-surface p-5 sm:p-8 ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {title && <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>}
      {intro && <div className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">{intro}</div>}
      <div className={title || intro ? 'mt-5' : ''}>{children}</div>
    </section>
  )
}

/** Big number with small uppercase captions above and below. */
export function BigStat({ above, value, below, tone = 'ink' }: {
  above: string; value: ReactNode; below?: ReactNode; tone?: 'ink' | 'critical' | 'warning' | 'ok'
}) {
  const cls = { ink: 'text-ink', critical: 'text-critical', warning: 'text-warning', ok: 'text-ok' }[tone]
  return (
    <div className="flex flex-col items-center px-3 py-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{above}</p>
      <p className={`tabular mt-2 text-5xl font-light leading-none sm:text-[3.5rem] ${cls}`}>{value}</p>
      {below && <p className="mt-3 max-w-[16rem] text-sm leading-snug text-muted">{below}</p>}
    </div>
  )
}

/** Row of big stats separated by thin vertical rules, as on the reference home page. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border bg-surface sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x [&>*]:py-2">
      {children}
    </div>
  )
}

/** Gray accordion bar with a SHOW / HIDE chevron, as on the reference Metrics Background page. */
export function Accordion({ title, children, defaultOpen = false, id }: {
  title: string; children: ReactNode; defaultOpen?: boolean; id?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  return (
    <section id={id} className="scroll-mt-24">
      <h2>
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 bg-surface-2 px-5 py-4 text-left shadow-[0_1px_2px_rgba(17,38,89,0.12)] transition hover:brightness-[0.98] sm:px-6 sm:py-5">
          <span className="text-xl font-medium tracking-tight text-ink sm:text-2xl">{title}</span>
          <span className="flex shrink-0 flex-col items-center text-ink">
            <span className="text-[10px] font-bold uppercase tracking-wider">{open ? 'Hide' : 'Show'}</span>
            <svg aria-hidden viewBox="0 0 24 12" className={`mt-0.5 h-3 w-6 transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M1 1l11 10L23 1" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="bg-surface px-5 py-6 text-[15px] leading-relaxed text-muted sm:px-8 print:block">
        {children}
      </div>
    </section>
  )
}

/** Small "Show the math" disclosure; plain words come first, formulas live in here. */
export function ShowMath({ children, label = 'Show the math' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="mt-3">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="no-print inline-flex items-center gap-1.5 border-b-2 pb-0.5 text-sm font-bold text-ink" style={{ borderColor: ACCENT }}>
        {open ? 'Hide the math' : label}
        <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      <div id={id} hidden={!open} className="print:block">{children}</div>
    </div>
  )
}

/** "How to read this chart" helper line. */
export function HowToRead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 bg-surface-2 px-4 py-2.5 text-sm text-muted">
      <strong className="font-semibold text-ink">How to read this chart: </strong>{children}
    </p>
  )
}

const arrow = (
  <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
    <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
)

/** Bold navy text link with a yellow underline and a right arrow ("Read more →"). */
export function ArrowLink({ children, to, href, download, external }: {
  children: ReactNode; to?: string; href?: string; download?: string | boolean; external?: boolean
}) {
  const cls = 'group inline-flex items-center gap-2 border-b-2 pb-0.5 text-[15px] font-bold text-ink hover:opacity-80'
  const style = { borderColor: ACCENT }
  if (to) return <Link to={to} className={cls} style={style}>{children}{arrow}</Link>
  return (
    <a href={href} className={cls} style={style}
      download={download === true ? '' : download || undefined}
      target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      {children}{arrow}
    </a>
  )
}

/** Square yellow (primary) or navy (secondary) button. */
export function BlockButton({ children, onClick, href, variant = 'yellow', download }: {
  children: ReactNode; onClick?: () => void; href?: string; variant?: 'yellow' | 'navy'; download?: boolean
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-[2px] px-5 py-2.5 text-[15px] font-bold transition hover:brightness-95 ${
    variant === 'yellow' ? 'text-[#112659]' : 'bg-navy text-navy-ink'}`
  const style = variant === 'yellow' ? { background: ACCENT } : undefined
  return href
    ? <a href={href} className={cls} style={style} download={download || undefined}>{children}</a>
    : <button type="button" onClick={onClick} className={cls} style={style}>{children}</button>
}

/** Plain source line for panels on these pages. */
export function Source({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-xs leading-snug text-muted">Source: {children}</p>
}
