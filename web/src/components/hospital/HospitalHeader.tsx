import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusPill } from '../ui'
import type { Hospital } from '../../lib/types'
import { plain, statusSentence } from './helpers'
import { titleCase } from '../../lib/format'
import { Eyebrow, NavyButton, YellowButton } from './shared'

function Stars({ n }: { n: number | null }) {
  if (n == null) return <span className="text-muted">No overall star rating</span>
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`Medicare overall star rating: ${n} out of 5`}>
      <span aria-hidden className="text-[#E3A42B]">
        {'★'.repeat(n)}
        <span className="text-border">{'★'.repeat(5 - n)}</span>
      </span>
      <span className="text-ink">{n} of 5 stars</span>
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
  const cityState = `${titleCase(h.city)}, ${h.state}`
  return (
    <header className="pb-2 pt-2">
      <nav aria-label="Breadcrumb" className="no-print mb-4 text-sm text-muted">
        <Link to="/" className="font-semibold text-ink underline decoration-[#FECA71] decoration-2 underline-offset-4">Home</Link>
        <span aria-hidden className="mx-2">/</span>
        <Link to="/hospitals" className="font-semibold text-ink underline decoration-[#FECA71] decoration-2 underline-offset-4">All hospitals</Link>
        <span aria-hidden className="mx-2">/</span>
        <span>{titleCase(plain(h.name))}</span>
      </nav>
      <Eyebrow>Hospital profile</Eyebrow>
      <h1 className="mt-1 text-3xl font-bold leading-tight text-ink sm:text-[44px]">{titleCase(plain(h.name))}</h1>
      <p className="mt-1 text-lg text-muted">{cityState}</p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="mb-2"><StatusPill status={status} /></div>
          <p className="max-w-3xl text-lg leading-relaxed text-ink sm:text-xl">{statusSentence(h)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-3">
          <YellowButton onClick={() => window.print()} ariaLabel="Print a one page summary of this hospital">
            Print a one page summary
          </YellowButton>
          <NavyButton onClick={copy} ariaLabel="Copy a link to this hospital page">
            <span aria-live="polite">{copied ? 'Link copied' : 'Copy link'}</span>
          </NavyButton>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[#C9D2E3] pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Hospital type</dt>
          <dd className="mt-0.5 text-ink">{plain(h.type) || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Owned by</dt>
          <dd className="mt-0.5 text-ink">{plain(h.ownership) || 'N/A'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Medicare star rating</dt>
          <dd className="mt-0.5"><Stars n={h.overall_rating} /></dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Compared with</dt>
          <dd className="mt-0.5 text-ink">
            {h.peer ? (
              <>
                {h.peer.n} similar hospitals <span className="text-muted">({plain(h.peer.label)})</span>
                {h.peer.fallback && <span className="block text-xs text-muted">Grouped by size and teaching status only, because the full group was too small.</span>}
              </>
            ) : (
              <span className="text-muted">No group of similar hospitals (size data not available)</span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Medicare ID (CCN) {h.ccn}{h.address ? ` · ${titleCase(plain(h.address))}, ${cityState} ${h.zip}` : ''}</p>
    </header>
  )
}
