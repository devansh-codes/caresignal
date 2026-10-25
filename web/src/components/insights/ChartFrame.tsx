import { useState, type ReactNode } from 'react'
import { Card, SourceNote } from '../ui'

/**
 * A card holding one chart and its table twin. The table is the accessible equivalent,
 * so a value is never readable only through a tooltip.
 */
export function ChartFrame({ title, subtitle, chart, table, source, footer, id }: {
  title: ReactNode; subtitle?: ReactNode; chart: ReactNode; table: ReactNode; source: string; footer?: ReactNode; id?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const btn = (v: 'chart' | 'table', label: string) => (
    <button type="button" onClick={() => setView(v)} aria-pressed={view === v}
      className={`px-2.5 py-1 text-xs font-medium ${view === v ? 'bg-primary text-primary-ink' : 'text-muted hover:text-ink'}`}>
      {label}
    </button>
  )
  return (
    <Card id={id} title={title} subtitle={subtitle}
      action={<div className="no-print inline-flex shrink-0 overflow-hidden rounded-md border border-border" role="group" aria-label="View as">{btn('chart', 'Chart')}{btn('table', 'Table')}</div>}>
      {view === 'chart' ? chart : table}
      {footer}
      <SourceNote>{source}</SourceNote>
    </Card>
  )
}

/** Plain compact table used as a chart's table twin. */
export function MiniTable({ headers, rows, caption }: { headers: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="max-h-80 overflow-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-2">
          <tr>{headers.map((h, i) => <th key={h} scope="col" className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              {r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j ? 'tabular text-right' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
