import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IndexEntry } from '../../lib/types'
import { StatusPill } from '../ui'
import { getSearchIndex, isCcnLike, type SearchIndex } from './searchIndex'

const MAX_RESULTS = 8

/**
 * Accessible hospital search (ARIA 1.2 combobox + listbox). Fuzzy-matches name, city, state and CCN;
 * an exact 6-character CCN navigates straight to that hospital.
 */
export function SearchBar({ size = 'md', autoFocus = false, onNavigate, label = 'Search hospitals' }: {
  size?: 'sm' | 'md' | 'lg'
  autoFocus?: boolean
  onNavigate?: () => void
  label?: string
}) {
  const navigate = useNavigate()
  const id = useId()
  const listId = `${id}-list`
  const [q, setQ] = useState('')
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  const ensureIndex = () => {
    if (index || error) return
    getSearchIndex().then(setIndex).catch(() => setError(true))
  }

  useEffect(() => {
    if (autoFocus) ensureIndex()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const term = q.trim()
  const results: IndexEntry[] = useMemo(() => {
    if (!index || term.length < 2) return []
    const exact = index.byCcn.get(term.toUpperCase())
    const hits = index.fuse.search(term, { limit: MAX_RESULTS }).map((r) => r.item)
    return exact ? [exact, ...hits.filter((h) => h.ccn !== exact.ccn)].slice(0, MAX_RESULTS) : hits
  }, [index, term])

  const go = (ccn: string) => {
    setOpen(false)
    setQ('')
    setActive(-1)
    onNavigate?.()
    navigate(`/hospital/${ccn}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Enter') {
      if (active >= 0 && results[active]) go(results[active].ccn)
      else if (isCcnLike(term)) go(term.toUpperCase())
      else if (results[0]) go(results[0].ccn)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const sizeCls = {
    sm: 'h-9 text-sm pl-9',
    md: 'h-11 text-base pl-10',
    lg: 'h-14 text-lg pl-12 shadow-sm',
  }[size]
  const iconCls = { sm: 'left-2.5 h-4 w-4', md: 'left-3 h-5 w-5', lg: 'left-4 h-5 w-5' }[size]
  const showList = open && term.length >= 2

  return (
    <div ref={wrapRef} className="relative w-full">
      <label htmlFor={`${id}-input`} className="sr-only">{label}</label>
      <svg aria-hidden viewBox="0 0 24 24" className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${iconCls}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={size === 'sm' ? 'Search hospital, city or CCN' : 'Search by hospital name, city, state or CCN (e.g. 010001)'}
        value={q}
        onFocus={() => {
          ensureIndex()
          setOpen(true)
        }}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setActive(-1)
          ensureIndex()
        }}
        onKeyDown={onKeyDown}
        className={`w-full rounded-lg border border-border bg-surface pr-3 text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${sizeCls}`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching hospitals"
          className="absolute left-0 right-0 z-40 mt-1 max-h-96 overflow-auto rounded-lg border border-border bg-surface py-1 shadow-xl"
        >
          {error && <li className="px-3 py-2 text-sm text-muted">Hospital list could not be loaded.</li>}
          {!error && !index && <li className="px-3 py-2 text-sm text-muted">Loading hospital list…</li>}
          {index && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No hospitals match “{term}”.</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.ccn}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                go(r.ccn)
              }}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${i === active ? 'bg-surface-2' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="block text-xs text-muted">
                  {r.city}, {r.state} · CCN {r.ccn}
                </span>
              </span>
              <StatusPill status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
