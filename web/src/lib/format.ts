import type { Category, HacMeasureKey, HacStatus, Period } from './types'

const nf = (d: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Missing values render as 'N/A' (tooltip: Not reported by CMS), never as 0. No dashes anywhere in visible text. */
export const NA = 'N/A'
/** Numbers use a true minus sign (U+2212), never a hyphen. */
const minus = (t: string) => t.replace(/^-/, '\u2212')
export const fmt = (v: number | null | undefined, digits = 2) => (v == null || Number.isNaN(v) ? NA : minus(nf(digits).format(v)))
export const fmtInt = (v: number | null | undefined) => (v == null ? NA : nf(0).format(v))
export const fmtPct = (v: number | null | undefined, digits = 0) => (v == null ? NA : `${nf(digits).format(v)}%`)
export const fmtSigned = (v: number | null | undefined, digits = 3) =>
  v == null ? NA : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(digits).format(Math.abs(v))}`
export const fmtUsd = (v: number | null | undefined) => {
  if (v == null) return NA
  if (Math.abs(v) >= 1e6) return `$${nf(1).format(v / 1e6)}M`
  if (Math.abs(v) >= 1e3) return `$${nf(0).format(v / 1e3)}K`
  return `$${nf(0).format(v)}`
}
export const fmtOrdinal = (n: number | null | undefined) => {
  if (n == null) return NA
  const r = Math.round(n)
  const s = ['th', 'st', 'nd', 'rd'][r % 100 > 10 && r % 100 < 14 ? 0 : r % 10 < 4 ? r % 10 : 0] ?? 'th'
  return `${r}${s}`
}
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return NA
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export const fmtPeriod = (p: Period | null | undefined) => (p ? `${fmtDate(p.start)} to ${fmtDate(p.end)}` : NA)

export const HAC_LABELS: Record<HacMeasureKey, string> = {
  psi90: 'Patient safety events',
  clabsi: 'Central line infections',
  cauti: 'Catheter infections',
  ssi: 'Surgical site infections',
  cdi: 'C. diff infections',
  mrsa: 'MRSA bloodstream infections',
}
/** Official CMS names, shown in small secondary text so readers can match official reports. */
export const HAC_TECH_LABELS: Record<HacMeasureKey, string> = {
  psi90: 'PSI 90 composite',
  clabsi: 'CLABSI',
  cauti: 'CAUTI',
  ssi: 'SSI (colon and abdominal hysterectomy)',
  cdi: 'CDI (C. difficile)',
  mrsa: 'MRSA bacteremia',
}
export const HAC_EVENT_NOUN: Record<HacMeasureKey, [string, string]> = {
  psi90: ['safety event', 'safety events'],
  clabsi: ['central line infection', 'central line infections'],
  cauti: ['catheter infection', 'catheter infections'],
  ssi: ['surgical site infection', 'surgical site infections'],
  cdi: ['C. diff infection', 'C. diff infections'],
  mrsa: ['MRSA bloodstream infection', 'MRSA bloodstream infections'],
}
export const CATEGORY_LABEL: Record<Category, string> = { nursing: 'Nursing driven', shared: 'Shared', other: 'Other' }
export const STATUS_LABEL: Record<HacStatus, string> = {
  penalized: 'Above the penalty line',
  near: 'Close to the line',
  clear: 'Below the line',
  exempt: 'Exempt (Maryland)',
  no_score: 'No safety score',
}

/** Read a CSS token as an rgb() string, for ECharts (which can't read Tailwind classes). */
export const token = (name: string, alpha = 1) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  return v ? `rgb(${v.split(' ').join(',')}${alpha < 1 ? `,${alpha}` : ''})`.replace('rgb(', alpha < 1 ? 'rgba(' : 'rgb(') : '#888'
}

/** CMS publishes names in capitals; show them in title case for readability (short joining words stay lower case). */
// Abbreviations that must stay uppercase when title-casing CMS's all-caps names.
// Short vowel-less words that are real abbreviations for words, not acronyms.
const NOT_ACRONYMS = new Set(['st', 'mt', 'ft', 'dr', 'jr', 'sr', 'mc', 'pt'])
const ACRONYMS = new Set(['afb', 'va', 'us', 'usa', 'uc', 'ucsf', 'ucla', 'unc', 'uab', 'upmc', 'osf', 'ssm', 'hca', 'nyu', 'ohsu', 'luhs', 'ii', 'iii', 'iv'])

export function titleCase(s: string) {
  const small = new Set(['of', 'and', 'the', 'at', 'in', 'for', 'on'])
  return s.toLowerCase().replace(/\b([a-z])([a-z']*)/g, (m, a: string, b: string, i: number) => {
    // A short word with no vowels (AFB, LLC, NYC) is an abbreviation.
    if (ACRONYMS.has(m) || (m.length <= 4 && !/[aeiouy]/.test(m) && !NOT_ACRONYMS.has(m))) return m.toUpperCase()
    return i > 0 && small.has(m) ? m : a.toUpperCase() + b
  })
}

/**
 * Remove dashes from text that comes from CMS files (e.g. "Acute Care - Veterans Administration").
 * Spaced or long dashes become a comma; a hyphen inside a word becomes a space. Use on any external string.
 */
export function noDash(s: string | null | undefined) {
  if (!s) return ''
  return s.replace(/\s*[\u2012\u2013\u2014\u2015]\s*/g, ', ').replace(/\s+-\s+/g, ', ').replace(/(\w)-(?=\w)/g, '$1 ')
}
