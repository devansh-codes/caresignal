import { createContext, useContext } from 'react'
import type { Category, Hospital, Measures, National, Period } from '../../lib/types'
import { fmtPeriod } from '../../lib/format'

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

/** Resolve CMS footnote codes ("5", "5, 29") to text from measures.json. */
export function footnoteText(code: string | null | undefined, measures: Measures | null): string | null {
  if (!code) return null
  const parts = String(code).split(/[,;\s]+/).filter(Boolean)
  const texts = parts.map((p) => {
    const t = measures?.footnotes?.[p]
    return t ? `Footnote ${p}: ${t}` : `CMS footnote ${p}`
  })
  return texts.join(' · ')
}

export const sourceLine = (id: string, label: string, period?: Period | null, extra?: string) =>
  `CMS ${label} (${id})${period ? ` · ${fmtPeriod(period)}` : ''}${extra ? ` · ${extra}` : ''}`

/** Category → CSS token name for charts. */
export const CAT_TOKEN: Record<Category, string> = { nursing: 'cat-nursing', shared: 'cat-shared', other: 'cat-other' }

export type HacView = 'program' | 'trajectory'
