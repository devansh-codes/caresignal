import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, PageHeader, SourceNote, StateView, StatusPill } from '../components/ui'
import { loadIndex, loadNational, useData } from '../lib/data'
import { fmt, fmtInt, fmtSigned, HAC_EVENT_NOUN, HAC_LABELS, STATUS_LABEL } from '../lib/format'
import type { HacStatus, IndexEntry } from '../lib/types'

const PAGE_SIZE = 50
const BEDS: Record<string, string> = { b0_99: '<100 beds', b100_299: '100–299 beds', b300_499: '300–499 beds', b500p: '500+ beds' }
const TEACH: Record<string, string> = { none: 'Non-teaching', minor: 'Minor teaching', major: 'Major teaching' }
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** Readable label for a peer key such as 'b100_299-minor-urban-south' when national.json lacks one. */
function peerLabelFromKey(key: string) {
  const [bed, teach, loc, region] = key.split('-')
  return [BEDS[bed] ?? bed, teach && (TEACH[teach] ?? teach), loc && cap(loc), region && cap(region)]
    .filter(Boolean)
    .join(' · ')
}
const STATUSES: HacStatus[] = ['penalized', 'near', 'clear', 'exempt', 'no_score']
type SortKey = 'name' | 'state' | 'hac' | 'gap' | 'tip'

const SORTERS: Record<SortKey, (a: IndexEntry, b: IndexEntry) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  state: (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
  hac: (a, b) => cmpNum(a.hac, b.hac),
  gap: (a, b) => cmpNum(a.gap, b.gap),
  tip: (a, b) => cmpNum(a.tip?.events ?? null, b.tip?.events ?? null),
}

// Nulls are split out and appended by the caller, so they sort last in either direction.
function cmpNum(a: number | null, b: number | null) {
  return (a ?? 0) - (b ?? 0)
}
const sortValue = (e: IndexEntry, k: SortKey) =>
  k === 'hac' ? e.hac : k === 'gap' ? e.gap : k === 'tip' ? (e.tip?.events ?? null) : 0

export default function Explore() {
  const index = useData(loadIndex)
  const national = useData(loadNational)
  const peerLabels = useMemo(() => {
    const m = new Map<string, string>()
    if (national.status === 'ready') national.data.peer_groups.forEach((p) => m.set(p.key, p.label))
    return m
  }, [national])

  return (
    <div>
      <PageHeader
        eyebrow="Hospital directory"
        title="Find a hospital"
        description="Every facility in CMS Hospital General Information, with its FY2026 HAC Reduction Program position. Filter by status, state or peer group, then open a hospital for the full breakdown."
      />
      {index.status === 'loading' && <StateView kind="loading" />}
      {index.status === 'error' && <StateView kind="error" message="The hospital directory could not be loaded." />}
      {index.status === 'ready' && <Directory entries={index.data} peerLabels={peerLabels} />}
    </div>
  )
}

function Directory({ entries, peerLabels }: { entries: IndexEntry[]; peerLabels: Map<string, string> }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const state = params.get('state') ?? ''
  const status = (params.get('status') ?? '') as HacStatus | ''
  const peer = params.get('peer') ?? ''
  const hasHac = params.get('hac') === '1'
  const sort = (params.get('sort') as SortKey) || 'name'
  const dir = params.get('dir') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }

  const states = useMemo(() => [...new Set(entries.map((e) => e.state))].filter(Boolean).sort(), [entries])
  const peers = useMemo(() => {
    const keys = [...new Set(entries.map((e) => e.peer).filter((p): p is string => !!p))]
    return keys.map((k) => ({ key: k, label: peerLabels.get(k) ?? peerLabelFromKey(k) })).sort((a, b) => a.label.localeCompare(b.label))
  }, [entries, peerLabels])

  // Everything except the status filter, so the chip bar shows counts that respond to other filters.
  const baseFiltered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return entries.filter(
      (e) =>
        (!term ||
          e.name.toLowerCase().includes(term) ||
          e.city.toLowerCase().includes(term) ||
          e.ccn.toLowerCase().includes(term)) &&
        (!state || e.state === state) &&
        (!peer || e.peer === peer) &&
        (!hasHac || e.hac != null),
    )
  }, [entries, q, state, peer, hasHac])

  const statusCounts = useMemo(() => {
    const c: Record<HacStatus, number> = { penalized: 0, near: 0, clear: 0, exempt: 0, no_score: 0 }
    baseFiltered.forEach((e) => c[e.status]++)
    return c
  }, [baseFiltered])

  const rows = useMemo(() => {
    const f = status ? baseFiltered.filter((e) => e.status === status) : baseFiltered
    const numeric = sort === 'hac' || sort === 'gap' || sort === 'tip'
    const withVal = numeric ? f.filter((e) => sortValue(e, sort) != null) : f
    const nulls = numeric ? f.filter((e) => sortValue(e, sort) == null) : []
    const sorted = [...withVal].sort(SORTERS[sort])
    if (dir === 'desc') sorted.reverse()
    return [...sorted, ...nulls.sort(SORTERS.name)]
  }, [baseFiltered, status, sort, dir])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const pageRows = rows.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  const anyFilter = q || state || status || peer || hasHac

  const setSort = (k: SortKey) => {
    if (sort === k) update({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else update({ sort: k, dir: k === 'name' || k === 'state' ? 'asc' : 'desc' })
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_auto]">
          <div>
            <label htmlFor="f-q" className="mb-1 block text-xs font-medium text-muted">Name, city or CCN</label>
            <input
              id="f-q"
              type="search"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="e.g. Mercy, Boston or 220071"
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="f-state" className="mb-1 block text-xs font-medium text-muted">State</label>
            <select id="f-state" value={state} onChange={(e) => update({ state: e.target.value })} className={selectCls}>
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-peer" className="mb-1 block text-xs font-medium text-muted">Peer group</label>
            <select id="f-peer" value={peer} onChange={(e) => update({ peer: e.target.value })} className={selectCls}>
              <option value="">All peer groups</option>
              {peers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="inline-flex h-10 items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={hasHac} onChange={(e) => update({ hac: e.target.checked ? '1' : null })}
                className="h-4 w-4 rounded border-border accent-[rgb(var(--primary))]" />
              Has HAC score
            </label>
            {anyFilter && (
              <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="h-10 text-sm font-medium text-primary hover:underline">
                Reset
              </button>
            )}
          </div>
        </div>

        <div role="group" aria-label="Filter by FY2026 HAC status" className="mt-4 flex flex-wrap gap-2">
          <ChipButton active={!status} onClick={() => update({ status: null })}>
            All <span className="tabular text-muted">{fmtInt(baseFiltered.length)}</span>
          </ChipButton>
          {STATUSES.map((s) => (
            <ChipButton key={s} active={status === s} onClick={() => update({ status: status === s ? null : s })}>
              <StatusPill status={s} />
              <span className="tabular text-muted">{fmtInt(statusCounts[s])}</span>
            </ChipButton>
          ))}
        </div>
      </Card>

      <Card className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted">
          <span aria-live="polite">
            {fmtInt(rows.length)} {rows.length === 1 ? 'hospital' : 'hospitals'}
            {status && ` · ${STATUS_LABEL[status]}`}
          </span>
          <span className="text-xs">Select a row to open the hospital’s penalty radar.</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 pb-4">
            <StateView kind="empty" message="No hospitals match these filters. Try clearing a filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-t border-border text-sm">
              <caption className="sr-only">Hospitals with FY2026 HAC Reduction Program status, sortable by column</caption>
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <Th k="name" sort={sort} dir={dir} onSort={setSort}>Hospital</Th>
                  <Th k="state" sort={sort} dir={dir} onSort={setSort}>Location</Th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <Th k="hac" sort={sort} dir={dir} onSort={setSort} align="right">Total HAC</Th>
                  <Th k="gap" sort={sort} dir={dir} onSort={setSort} align="right">Gap to cutoff</Th>
                  <Th k="tip" sort={sort} dir={dir} onSort={setSort} className="hidden md:table-cell">Tipping measure</Th>
                  <th scope="col" className="hidden px-4 py-2 font-medium lg:table-cell">Peer group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((e) => (
                  <tr key={e.ccn} onClick={() => navigate(`/hospital/${e.ccn}`)}
                    className="cursor-pointer hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link to={`/hospital/${e.ccn}`} onClick={(ev) => ev.stopPropagation()}
                        className="font-medium text-ink hover:text-primary hover:underline">
                        {e.name}
                      </Link>
                      <div className="text-xs text-muted">CCN {e.ccn} · {e.type}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{e.city}, {e.state}</td>
                    <td className="px-4 py-2.5"><StatusPill status={e.status} /></td>
                    <td className="tabular px-4 py-2.5 text-right text-ink">{fmt(e.hac, 4)}</td>
                    <td className={`tabular px-4 py-2.5 text-right ${e.gap != null && e.gap > 0 ? 'font-medium text-critical' : 'text-ink'}`}>
                      {fmtSigned(e.gap, 4)}
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      {e.tip ? (
                        <span>
                          <span className="text-ink">{HAC_LABELS[e.tip.measure]}</span>
                          <span className="block text-xs text-muted">
                            {e.status === 'penalized' ? '~' : ''}{fmtInt(e.tip.events)} {HAC_EVENT_NOUN[e.tip.measure][e.tip.events === 1 ? 0 : 1]}
                            {e.status === 'penalized' ? ' to clear' : ' to cross'}
                          </span>
                        </span>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted lg:table-cell">
                      {e.peer ? peerLabels.get(e.peer) ?? peerLabelFromKey(e.peer) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
            <button type="button" disabled={cur <= 1} onClick={() => update({ page: String(cur - 1) }, false)} className={pagerCls}>
              ← Previous
            </button>
            <span className="tabular text-muted">Page {cur} of {pages}</span>
            <button type="button" disabled={cur >= pages} onClick={() => update({ page: String(cur + 1) }, false)} className={pagerCls}>
              Next →
            </button>
          </nav>
        )}
        <div className="px-4 pb-4">
          <SourceNote>
            CMS Hospital General Information (xubh-q36u); FY2026 HAC Reduction Program (yq43-i98g). Gap = Total HAC Score − FY2026 cutoff; positive values are above the cutoff. Tipping measure: fewest whole infections in a single HAI measure that would change status (approximate).
          </SourceNote>
        </div>
      </Card>
    </div>
  )
}

const selectCls =
  'h-10 w-full rounded-md border border-border bg-surface px-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30'
const pagerCls =
  'rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm transition ${
        active ? 'border-primary bg-primary/10 text-ink' : 'border-border bg-surface text-ink hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  )
}

function Th({ k, sort, dir, onSort, children, align = 'left', className = '' }: {
  k: SortKey; sort: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void
  children: React.ReactNode; align?: 'left' | 'right'; className?: string
}) {
  const active = sort === k
  return (
    <th scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-2 font-medium ${align === 'right' ? 'text-right' : ''} ${className}`}>
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${active ? 'text-ink' : ''}`}>
        {children}
        <span aria-hidden className="text-[10px]">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}
