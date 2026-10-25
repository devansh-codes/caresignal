import { useMemo, useState, type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  /** Value used for sorting; null always sorts last. */
  sortValue?: (row: T) => number | string | null
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
  className?: string
}

/** Accessible sortable table: header buttons, aria-sort, sticky header, nulls last. */
export function SortableTable<T>({ rows, columns, initialSort, initialDir = 'desc', caption, rowKey, maxHeight = 480, emptyMessage = 'No rows match.' }: {
  rows: T[]
  columns: Column<T>[]
  initialSort?: string
  initialDir?: 'asc' | 'desc'
  caption: string
  rowKey: (row: T) => string
  maxHeight?: number
  emptyMessage?: string
}) {
  const [sort, setSort] = useState<{ key?: string; dir: 'asc' | 'desc' }>({ key: initialSort, dir: initialDir })
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const sv = col.sortValue
    const m = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = sv(a), y = sv(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * m
      return String(x).localeCompare(String(y)) * m
    })
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  return (
    <div className="overflow-auto rounded-md border border-border" style={{ maxHeight }}>
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr>
            {columns.map((c) => {
              const active = sort.key === c.key
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
              return (
                <th key={c.key} scope="col" aria-sort={c.sortValue ? ariaSort : undefined}
                  className={`border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)}
                      className={`inline-flex items-center gap-1 uppercase hover:text-ink ${active ? 'text-ink' : ''} ${c.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {c.header}
                      <span aria-hidden className="text-[10px]">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : c.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-muted">{emptyMessage}</td></tr>
          )}
          {sorted.map((r) => (
            <tr key={rowKey(r)} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'tabular text-right' : ''} ${c.className ?? ''}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
