import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, InfoTip, StatusPill } from '../ui'
import type { Hospital } from '../../lib/types'

function Stars({ n }: { n: number | null }) {
  if (n == null) return <span className="text-muted">Overall rating not available</span>
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`CMS overall hospital rating ${n} of 5 stars`}>
      <span aria-hidden className="tracking-tight text-ink">
        {'★'.repeat(n)}
        <span className="text-border">{'★'.repeat(5 - n)}</span>
      </span>
      <span className="text-muted">{n}/5 CMS overall</span>
    </span>
  )
}

export default function HospitalHeader({ h }: { h: Hospital }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  const status = h.hac?.status ?? 'no_score'
  return (
    <header className="mb-5">
      <nav aria-label="Breadcrumb" className="no-print mb-2 text-xs text-muted">
        <Link to="/" className="hover:text-ink">Home</Link>
        <span aria-hidden> / </span>
        <Link to="/hospitals" className="hover:text-ink">Hospitals</Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{h.ccn}</span>
      </nav>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{h.name}</h1>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {h.address && <>{h.address}, </>}
            {h.city}, {h.state} {h.zip} · CCN <span className="font-mono text-ink">{h.ccn}</span>
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <div className="flex gap-1.5"><dt className="text-muted">Type</dt><dd className="text-ink">{h.type || '—'}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted">Ownership</dt><dd className="text-ink">{h.ownership || '—'}</dd></div>
            <div className="flex gap-1.5"><dt className="sr-only">Rating</dt><dd><Stars n={h.overall_rating} /></dd></div>
            <div className="flex items-center gap-1.5">
              <dt className="text-muted">Peer group</dt>
              <dd className="flex items-center gap-1 text-ink">
                {h.peer ? (
                  <>
                    {h.peer.label} <span className="text-muted">(n={h.peer.n})</span>
                    {h.peer.fallback && <InfoTip text="The full peer group (bed size × teaching × urban/rural × region) had fewer than 15 HAC-scored hospitals, so this hospital is compared within bed size × teaching only." />}
                  </>
                ) : (
                  <span className="text-muted">Not assigned (no cost report match)</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div className="no-print flex shrink-0 gap-2">
          <Button variant="primary" onClick={() => window.print()} ariaLabel="Print a one-page brief for this hospital">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-current"><path d="M4 1h8v4H4zM2 6h12a1 1 0 0 1 1 1v5h-3v3H4v-3H1V7a1 1 0 0 1 1-1Zm3 6v2h6v-2z" /></svg>
            Print brief
          </Button>
          <Button onClick={copy} ariaLabel="Copy a link to this hospital">
            <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-current"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.2 1.2a2.5 2.5 0 0 1-3.5-3.5L5.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
