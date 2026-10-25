import { Link } from 'react-router-dom'
import { loadManifest, useData } from '../../lib/data'
import { fmtDate } from '../../lib/format'

/** Data freshness is always visible: stale numbers on a quality screen can look authoritative. */
export function FreshnessBanner() {
  const s = useData(loadManifest)
  let text = 'Loading data freshness…'
  if (s.status === 'error') text = 'Data freshness unavailable'
  if (s.status === 'ready') {
    const dates = s.data.sources.map((x) => x.modified).filter((d): d is string => !!d).sort()
    const latest = dates[dates.length - 1] ?? null
    text = `CMS data as of ${fmtDate(latest)} · FY2026 HAC program year · Refreshed weekly`
  }
  return (
    <div className="no-print border-b border-border bg-surface-2 text-xs text-muted">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-4 px-4 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5" aria-live="polite">
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.status === 'error' ? 'bg-warning' : 'bg-primary'}`} />
          <span className="truncate">{text}</span>
        </span>
        <Link to="/data-quality" className="shrink-0 font-medium text-primary hover:underline">
          <span className="sm:hidden">Sources →</span>
          <span className="hidden sm:inline">Sources &amp; data quality →</span>
        </Link>
      </div>
    </div>
  )
}
