import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, PageHeader, SourceNote, StateView, StatusPill } from '../components/ui'
import { loadIndex, useData } from '../lib/data'
import { fmt, fmtInt, HAC_EVENT_NOUN, HAC_LABELS, NA, noDash, STATUS_LABEL, titleCase } from '../lib/format'
import type { HacStatus, IndexEntry } from '../lib/types'

const PAGE_SIZE = 50
const BEDS: Record<string, string> = { b0_99: 'Under 100 beds', b100_299: '100 to 299 beds', b300_499: '300 to 499 beds', b500p: '500 or more beds' }
const TEACH: Record<string, string> = { none: 'Not a teaching hospital', minor: 'Some teaching', major: 'Major teaching hospital' }
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** Plain label for a peer key such as 'b100_299-minor-urban-south' (built from the key so it never has dashes). */
function peerLabelFromKey(key: string) {
  const [bed, teach, loc, region] = key.split('-')
  return [BEDS[bed] ?? bed, teach && (TEACH[teach] ?? teach), loc && cap(loc), region && cap(region)]
    .filter(Boolean)
    .join(', ')
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

  return (
    <div>
      <PageHeader
        eyebrow="All hospitals"
        title="Find a hospital"
        description="Every hospital Medicare lists, with where it stands for the FY2026 safety penalty. Use the filters to narrow the list, then select a hospital to see its full profile."
      />
      {index.status === 'loading' && <StateView kind="loading" />}
      {index.status === 'error' && <StateView kind="error" message="The hospital directory could not be loaded." />}
      {index.status === 'ready' && <Directory entries={index.data} />}
    </div>
  )
}

function Directory({ entries }: { entries: IndexEntry[] }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''
  const state = params.get('state') ?? ''
  const status = (params.get('status') ?? '') as HacStatus | ''
  const peer = params.get('peer') ?? ''
  // Default view: only hospitals with a safety score (rows of N/A help nobody). Picking 'No safety score' includes the rest.
  const hasHac = params.get('hac') !== '0' && status !== 'no_score'
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
    return keys.map((k) => ({ key: k, label: peerLabelFromKey(k) })).sort((a, b) => a.label.localeCompare(b.label))
  }, [entries])

  // Everything except the status filter, so the chip bar shows counts that respond to other filters.
  // Chip counts ignore the score toggle so 'No safety score' always shows its real count.
  const matched = useMemo(() => {
    const term = q.trim().toLowerCase()
    return entries.filter(
      (e) =>
        (!term ||
          e.name.toLowerCase().includes(term) ||
          e.city.toLowerCase().includes(term) ||
          e.ccn.toLowerCase().includes(term)) &&
        (!state || e.state === state) &&
        (!peer || e.peer === peer),
    )
  }, [entries, q, state, peer])
  const baseFiltered = useMemo(() => (hasHac ? matched.filter((e) => e.hac != null) : matched), [matched, hasHac])

  const statusCounts = useMemo(() => {
    const c: Record<HacStatus, number> = { penalized: 0, near: 0, clear: 0, exempt: 0, no_score: 0 }
    matched.forEach((e) => c[e.status]++)
    return c
  }, [matched])

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
  const anyFilter = q || state || status || peer || !hasHac

  const setSort = (k: SortKey) => {
    if (sort === k) update({ dir: dir === 'asc' ? 'desc' : 'asc' })
    else update({ sort: k, dir: k === 'name' || k === 'state' ? 'asc' : 'desc' })
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_auto]">
          <div>
            <label htmlFor="f-q" className="mb-1.5 block text-sm font-bold text-royal dark:text-primary">Hospital name, city or Medicare ID</label>
            <input
              id="f-q"
              type="search"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="For example Mercy, Boston or 220071"
              className="h-11 w-full rounded-none border-0 border-b-2 border-yellow bg-surface-2/60 px-3 text-[15px] font-medium text-ink placeholder:text-muted focus:border-royal focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="f-state" className="mb-1.5 block text-sm font-bold text-royal dark:text-primary">State</label>
            <select id="f-state" value={state} onChange={(e) => update({ state: e.target.value })} className={selectCls}>
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-peer" className="mb-1.5 block text-sm font-bold text-royal dark:text-primary">Similar hospitals</label>
            <select id="f-peer" value={peer} onChange={(e) => update({ peer: e.target.value })} className={selectCls}>
              <option value="">All sizes and types</option>
              {peers.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <label className="inline-flex h-11 items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!hasHac} onChange={(e) => update({ hac: e.target.checked ? '0' : null })}
                className="h-4 w-4 rounded border-border accent-[rgb(var(--primary))]" />
              Include hospitals without a safety score
            </label>
            {anyFilter && (
              <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })}
                className="h-11 whitespace-nowrap text-sm font-bold text-ink underline decoration-yellow decoration-2 underline-offset-4">
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div role="group" aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2 border-t border-rule pt-5">
          <ChipButton active={!status} onClick={() => update({ status: null })}>
            {hasHac ? "All with a score" : "All"} <span className="tabular text-muted">{fmtInt(baseFiltered.length)}</span>
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
            {status && `, ${STATUS_LABEL[status].toLowerCase()}`}
          </span>
          <span className="text-xs">Select a hospital to open its full profile.</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 pb-4">
            <StateView kind="empty" message="No hospitals match these filters. Try clearing a filter." />
          </div>
        ) : (
          <>
          {/* Phones: stacked cards so status and score are always visible without sideways scrolling. */}
          <ul className="divide-y divide-rule border-t border-rule sm:hidden">
            {pageRows.map((e) => (
              <li key={e.ccn}>
                <Link to={`/hospital/${e.ccn}`} className="block px-4 py-4 active:bg-surface-2">
                  <StatusPill status={e.status} />
                  <span className="mt-2 block font-bold text-ink">{titleCase(e.name)}</span>
                  <span className="block text-sm text-body">{titleCase(e.city)}, {e.state}</span>
                  {e.hac != null && (
                    <span className="mt-1 block text-sm text-body">
                      Safety score <span className="tabular font-bold text-ink">{fmt(e.hac, 3)}</span>
                      {e.gap != null && <>, {e.gap > 0 ? <span className="text-critical">{fmt(e.gap, 3)} above the line</span> : `${fmt(-e.gap, 3)} below the line`}</>}
                    </span>
                  )}
                  {e.tip && e.status === 'penalized' && (
                    <span className="mt-1 block text-sm text-body">
                      About {fmtInt(e.tip.events)} fewer {HAC_EVENT_NOUN[e.tip.measure][e.tip.events === 1 ? 0 : 1]} to get below
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] border-t border-border text-sm">
              <caption className="sr-only">Hospitals and where they stand for the FY2026 safety penalty, sortable by column</caption>
              <thead className="bg-navy text-left text-xs uppercase tracking-wide text-white">
                <tr>
                  <Th k="name" sort={sort} dir={dir} onSort={setSort}>Hospital</Th>
                  <Th k="state" sort={sort} dir={dir} onSort={setSort}>Location</Th>
                  <th scope="col" className="px-4 py-3 font-bold">Status</th>
                  <Th k="hac" sort={sort} dir={dir} onSort={setSort} align="right">Safety score</Th>
                  <Th k="gap" sort={sort} dir={dir} onSort={setSort} align="right">Distance to line</Th>
                  <Th k="tip" sort={sort} dir={dir} onSort={setSort} className="hidden md:table-cell">Biggest opportunity</Th>
                  <th scope="col" className="hidden px-4 py-3 font-bold lg:table-cell">Similar hospitals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((e) => (
                  <tr key={e.ccn} onClick={() => navigate(`/hospital/${e.ccn}`)}
                    className="cursor-pointer hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link to={`/hospital/${e.ccn}`} onClick={(ev) => ev.stopPropagation()}
                        className="font-bold text-ink hover:underline hover:decoration-yellow hover:decoration-2 hover:underline-offset-4">
                        {titleCase(e.name)}
                      </Link>
                      <div className="text-xs text-muted">Medicare ID {e.ccn}. {noDash(e.type)}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-body">{titleCase(e.city)}, {e.state}</td>
                    <td className="px-4 py-2.5"><StatusPill status={e.status} /></td>
                    <td className="tabular px-4 py-2.5 text-right text-ink">{fmt(e.hac, 3)}</td>
                    <td className={`tabular px-4 py-2.5 text-right ${e.gap != null && e.gap > 0 ? 'font-medium text-critical' : 'text-ink'}`}>
                      {e.gap == null ? NA : e.gap > 0 ? `${fmt(e.gap, 3)} above` : `${fmt(-e.gap, 3)} below`}
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      {e.tip ? (
                        <span>
                          <span className="text-ink">{HAC_LABELS[e.tip.measure]}</span>
                          <span className="block text-xs text-muted">
                            {e.status === 'penalized'
                              ? `About ${fmtInt(e.tip.events)} fewer ${HAC_EVENT_NOUN[e.tip.measure][e.tip.events === 1 ? 0 : 1]} to get below`
                              : `${fmtInt(e.tip.events)} more ${HAC_EVENT_NOUN[e.tip.measure][e.tip.events === 1 ? 0 : 1]} would cross`}
                          </span>
                        </span>
                      ) : e.status === 'clear' ? (
                        <span className="text-ok">Not needed</span>
                      ) : e.status === 'near' ? (
                        <span className="text-body">See profile</span>
                      ) : <span className="text-muted" title="Not reported by CMS">{NA}</span>}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted lg:table-cell">
                      {e.peer ? peerLabelFromKey(e.peer) : NA}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
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
            CMS Hospital General Information and the CMS Hospital Acquired Condition Reduction Program, FY2026. The safety score is the official Total HAC Score; higher is worse. Distance to line compares it with this year's penalty line. Biggest opportunity is the infection type where the fewest cases would change the hospital's status. These counts are estimates.
          </SourceNote>
        </div>
      </Card>
    </div>
  )
}

const selectCls =
  'h-11 w-full rounded-none border-0 border-b-2 border-yellow bg-surface-2/60 px-2 text-[15px] font-medium text-ink focus:border-royal focus:outline-none'
const pagerCls =
  'rounded-sm bg-yellow px-4 py-2 font-bold text-[#112659] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40'

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition ${
        active ? 'border-navy bg-navy/5 text-ink ring-1 ring-navy' : 'border-rule bg-surface text-ink hover:bg-surface-2'
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
      className={`px-4 py-3 font-bold ${align === 'right' ? 'text-right' : ''} ${className}`}>
      <button type="button" onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-yellow ${active ? 'text-yellow' : ''}`}>
        {children}
        <span aria-hidden className="text-[10px]">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}
