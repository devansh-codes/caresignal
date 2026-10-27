import { createContext, useContext } from 'react'
import type { Category, HacMeasureKey, Hospital, Measures, National, Period } from '../../lib/types'
import { HAC_EVENT_NOUN, fmt, fmtPeriod } from '../../lib/format'

/** Page-level context so deep components can resolve footnotes and national params without prop drilling. */
export interface HospitalCtx {
  hospital: Hospital
  national: National | null
  measures: Measures | null
}
export const Ctx = createContext<HospitalCtx | null>(null)
export function useHospitalCtx() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useHospitalCtx outside provider')
  return c
}

/**
 * Plain text guard for strings that come from CMS files (labels, ownership, peer names, footnotes).
 * The site shows no dashes: ranges become "to", spaced dashes become commas, compound hyphens become spaces.
 */
export function plain(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 to $2')
    .replace(/\s+[–—-]+\s+/g, ', ')
    .replace(/[–—]/g, ' ')
    .replace(/([A-Za-z])-(?=[A-Za-z])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Resolve CMS footnote codes ("5", "5, 29") to text from measures.json. */
export function footnoteText(code: string | null | undefined, measures: Measures | null): string | null {
  if (!code) return null
  const parts = String(code).split(/[,;\s]+/).filter(Boolean)
  const texts = parts.map((p) => {
    const t = measures?.footnotes?.[p]
    return t ? `CMS note ${p}: ${plain(t)}` : `CMS note ${p}`
  })
  return texts.join(' · ')
}

/** "CMS Healthcare Associated Infections file, data from Oct 1, 2024 to Sep 30, 2025" */
export const sourceLine = (label: string, period?: Period | null, extra?: string) =>
  `CMS ${label}${period ? `, data from ${fmtPeriod(period)}` : ''}${extra ? `. ${extra}` : ''}`

/** Category → CSS token name for charts. */
export const CAT_TOKEN: Record<Category, string> = { nursing: 'cat-nursing', shared: 'cat-shared', other: 'cat-other' }

export type HacView = 'program' | 'trajectory'

/** Lowercase a label for use mid sentence, keeping acronyms (MRSA) and "C." intact. */
export const lower = (s: string) =>
  s.split(' ').map((w) => (/[A-Z].*[A-Z]/.test(w) || /^C\.$/.test(w) ? w : w.toLowerCase())).join(' ')

export const noun = (k: HacMeasureKey, n: number) => HAC_EVENT_NOUN[k][n === 1 ? 0 : 1]

/** Translate pipeline / simulator feasibility reasons into plain sentences. */
export function plainReason(reason: string | null | undefined): string {
  const r = (reason ?? '').toLowerCase()
  if (!r) return 'Cannot be calculated for this infection.'
  if (r.includes('already at or below') || r.includes('already clear')) return 'Already below the line.'
  if (r.includes('already above')) return 'Already above the line.'
  if (r.includes('no result')) return 'No result reported for this measure.'
  if (r.includes('composite')) return 'Patient safety events are reported as one combined rate, so a count of events cannot be calculated.'
  if (r.includes('no submitted data') || r.includes('maximum z')) return 'CMS gave the worst possible score because no data was submitted. Reporting the data is the first step.'
  if (r.includes('predicted')) return 'CMS did not publish an expected count, so a number cannot be calculated.'
  if (r.includes('floor')) return 'This infection alone cannot close the gap. The rate is already near the lowest level CMS counts.'
  if (r.includes('cap') || r.includes('ceiling')) return 'More of this infection alone would not push the score over the line, because CMS caps very high rates.'
  if (r.includes('no total')) return 'No safety score.'
  return plain(reason)
}

/** One or two sentences that answer "where does this hospital stand?" without jargon. */
export function statusSentence(h: Hospital): string {
  const hac = h.hac
  if (!hac) return 'Medicare does not give this hospital a safety score, so this penalty does not apply. Infection, patient survey and readmission results are in the tabs below.'
  const pts = (g: number) => `${fmt(Math.abs(g), 2)} points`
  if (hac.status === 'exempt')
    return `This Maryland hospital has a safety score of ${fmt(hac.total, 2)}, which is ${hac.gap > 0 ? 'above' : 'below'} the national penalty line by ${pts(hac.gap)}. Maryland hospitals are exempt from this Medicare penalty, so no payment is taken away.`
  if (hac.gap > 0) {
    const t = hac.patients_to_prevent.find((p) => p.measure === hac.tipping_measure && p.feasible && p.events != null)
    const first = `This hospital is above the Medicare penalty line by ${pts(hac.gap)}, so Medicare reduces its payments by 1%.`
    return t
      ? `${first} Preventing about ${t.events} ${noun(t.measure, t.events as number)} would bring it below the line.`
      : `${first} No single type of infection alone would bring it below the line, so progress is needed in several areas.`
  }
  const c = (hac.cushion_events ?? []).filter((p) => p.feasible && p.events != null).sort((a, b) => (a.events as number) - (b.events as number))[0]
  if (hac.status === 'near' && c)
    return `This hospital is below the Medicare penalty line by ${pts(hac.gap)}, but it is close. About ${c.events} more ${noun(c.measure, c.events as number)} could push it over.`
  return c
    ? `This hospital is below the Medicare penalty line by ${pts(hac.gap)}. It would take about ${c.events} more ${noun(c.measure, c.events as number)} to cross it.`
    : `This hospital is below the Medicare penalty line by ${pts(hac.gap)}. No single type of infection alone would push it over.`
}
