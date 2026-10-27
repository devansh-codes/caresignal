import { Link } from 'react-router-dom'
import { loadManifest, useData } from '../../lib/data'
import { fmtDate } from '../../lib/format'

/** Data freshness is always visible: stale numbers on a quality screen can look authoritative. */
export function FreshnessBanner() {
  const s = useData(loadManifest)
  let text = 'Checking when the data was last updated'
  if (s.status === 'error') text = 'Data update date is unavailable right now'
  if (s.status === 'ready') {
    const dates = s.data.sources.map((x) => x.modified).filter((d): d is string => !!d).sort()
    const latest = dates[dates.length - 1] ?? null
    text = `CMS data last updated ${fmtDate(latest)}. Penalty year FY2026. We check for new data every week.`
  }
  return (
    <div className="no-print border-b border-rule/70 bg-surface text-xs text-body">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-x-4 px-4 py-2 sm:px-8">
        <span className="flex min-w-0 items-center gap-2" aria-live="polite">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${s.status === 'error' ? 'bg-warning' : 'bg-ok'}`} />
          <span className="truncate">{text}</span>
        </span>
        <Link to="/data-quality" className="shrink-0 font-bold text-ink underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-royal">
          About the data
        </Link>
      </div>
    </div>
  )
}
