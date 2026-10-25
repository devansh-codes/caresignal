import Fuse from 'fuse.js'
import { loadIndex } from '../../lib/data'
import type { IndexEntry } from '../../lib/types'

export interface SearchIndex {
  entries: IndexEntry[]
  byCcn: Map<string, IndexEntry>
  fuse: Fuse<IndexEntry>
}

let pending: Promise<SearchIndex> | null = null

/** Builds the fuzzy index once per page load; index.json is fetched lazily on first use. */
export function getSearchIndex(): Promise<SearchIndex> {
  if (!pending) {
    pending = loadIndex().then((entries) => ({
      entries,
      byCcn: new Map(entries.map((e) => [e.ccn.toUpperCase(), e])),
      fuse: new Fuse(entries, {
        keys: [
          { name: 'name', weight: 0.6 },
          { name: 'city', weight: 0.2 },
          { name: 'ccn', weight: 0.15 },
          { name: 'state', weight: 0.05 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    }))
    pending.catch(() => {
      pending = null
    })
  }
  return pending
}

export const isCcnLike = (q: string) => /^[0-9A-Za-z]{6}$/.test(q.trim()) && /\d{4}/.test(q)
