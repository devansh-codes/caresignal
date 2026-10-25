import type { Category, HacMeasureKey, HacStatus, Period } from './types'

const nf = (d: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Missing values render as an em dash, never as 0. */
export const fmt = (v: number | null | undefined, digits = 2) => (v == null || Number.isNaN(v) ? '—' : nf(digits).format(v))
export const fmtInt = (v: number | null | undefined) => (v == null ? '—' : nf(0).format(v))
export const fmtPct = (v: number | null | undefined, digits = 0) => (v == null ? '—' : `${nf(digits).format(v)}%`)
export const fmtSigned = (v: number | null | undefined, digits = 3) =>
  v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(digits).format(Math.abs(v))}`
export const fmtUsd = (v: number | null | undefined) => {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e6) return `$${nf(1).format(v / 1e6)}M`
  if (Math.abs(v) >= 1e3) return `$${nf(0).format(v / 1e3)}K`
  return `$${nf(0).format(v)}`
}
export const fmtOrdinal = (n: number | null | undefined) => {
  if (n == null) return '—'
  const r = Math.round(n)
  const s = ['th', 'st', 'nd', 'rd'][r % 100 > 10 && r % 100 < 14 ? 0 : r % 10 < 4 ? r % 10 : 0] ?? 'th'
  return `${r}${s}`
}
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export const fmtPeriod = (p: Period | null | undefined) => (p ? `${fmtDate(p.start)} – ${fmtDate(p.end)}` : '—')

export const HAC_LABELS: Record<HacMeasureKey, string> = {
  psi90: 'PSI 90 Patient Safety',
  clabsi: 'CLABSI',
  cauti: 'CAUTI',
  ssi: 'SSI (colon + hysterectomy)',
  cdi: 'C. difficile (CDI)',
  mrsa: 'MRSA bacteremia',
}
export const HAC_EVENT_NOUN: Record<HacMeasureKey, [string, string]> = {
  psi90: ['safety event', 'safety events'],
  clabsi: ['CLABSI', 'CLABSIs'],
  cauti: ['CAUTI', 'CAUTIs'],
  ssi: ['SSI', 'SSIs'],
  cdi: ['C. diff infection', 'C. diff infections'],
  mrsa: ['MRSA infection', 'MRSA infections'],
}
export const CATEGORY_LABEL: Record<Category, string> = { nursing: 'Nursing-driven', shared: 'Shared', other: 'Other' }
export const STATUS_LABEL: Record<HacStatus, string> = {
  penalized: 'Penalized',
  near: 'Near cutoff',
  clear: 'Clear',
  exempt: 'Exempt (Maryland)',
  no_score: 'No HAC score',
}

/** Read a CSS token as an rgb() string, for ECharts (which can't read Tailwind classes). */
export const token = (name: string, alpha = 1) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  return v ? `rgb(${v.split(' ').join(',')}${alpha < 1 ? `,${alpha}` : ''})`.replace('rgb(', alpha < 1 ? 'rgba(' : 'rgb(') : '#888'
}
