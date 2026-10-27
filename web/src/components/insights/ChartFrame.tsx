import { useState, type ReactNode } from 'react'
import { HowToRead, Panel, Source } from './layout'

/**
 * A panel holding one chart and its table twin. The title states the takeaway in plain words;
 * the table is the accessible equivalent, so a value is never readable only through a tooltip.
 */
export function ChartFrame({ title, subtitle, chart, table, source, footer, id, howToRead }: {
  title: ReactNode; subtitle?: ReactNode; chart: ReactNode; table: ReactNode; source: string; footer?: ReactNode; id?: string; howToRead?: ReactNode
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const btn = (v: 'chart' | 'table', label: string) => (
    <button type="button" onClick={() => setView(v)} aria-pressed={view === v}
      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider ${view === v ? 'bg-navy text-navy-ink' : 'text-ink hover:bg-surface-2'}`}>
      {label}
    </button>
  )
  return (
    <Panel id={id} title={title} intro={subtitle}>
      <div className="no-print mb-3 flex justify-end">
        <div className="inline-flex overflow-hidden rounded-[2px] border border-ink/40" role="group" aria-label="Show as">
          {btn('chart', 'Chart')}{btn('table', 'Table')}
        </div>
      </div>
      {view === 'chart' ? chart : table}
      {howToRead && view === 'chart' && <HowToRead>{howToRead}</HowToRead>}
      {footer}
      <Source>{source}</Source>
    </Panel>
  )
}

/** Plain compact table used as a chart's table twin. */
export function MiniTable({ headers, rows, caption }: { headers: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="max-h-80 overflow-auto border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-2">
          <tr>{headers.map((h, i) => <th key={h} scope="col" className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/60">
              {r.map((c, j) => <td key={j} className={`px-3 py-1.5 text-ink ${j ? 'tabular text-right' : ''}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
