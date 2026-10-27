import type { Category, HacMeasureKey, HacStatus, Hospital, PatientsToPrevent, Period } from '../../lib/types'
import { HAC_LABELS } from '../../lib/format'
import { HAC_KEYS, totalScore } from '../../lib/simulate'
import type { HacView } from './helpers'

/** Fallback categories when a block doesn't carry them (trajectory). Mirrors config/measure_map.yaml. */
const DEFAULT_CAT: Record<HacMeasureKey, Category> = {
  psi90: 'shared',
  clabsi: 'nursing',
  cauti: 'nursing',
  ssi: 'other',
  cdi: 'shared',
  mrsa: 'shared',
}

export interface VmMeasure {
  key: HacMeasureKey
  label: string
  category: Category
  value: number | null
  z: number | null
  weight: number
  contribution: number | null
  predicted: number | null
  observed: number | null
}

export interface HacViewModel {
  view: HacView
  label: string
  source: string
  periodText: { label: string; period: Period }[]
  total: number | null
  cutoff: number
  gap: number | null
  status: HacStatus
  measures: VmMeasure[]
  ptp: PatientsToPrevent[]
  tipping: HacMeasureKey | null
  cushion: PatientsToPrevent[] | null
}

export function buildViewModel(h: Hospital, view: HacView, cutoff: number): HacViewModel | null {
  const hac = h.hac
  if (view === 'program' || !h.trajectory) {
    if (!hac) return null
    return {
      view: 'program',
      label: `Official FY${hac.fiscal_year} score`,
      source: hac.source,
      periodText: [
        { label: 'Patient safety events', period: hac.period.psi90 },
        { label: 'Infections', period: hac.period.hai },
      ],
      total: hac.total,
      cutoff: hac.cutoff,
      gap: hac.gap,
      status: hac.status,
      measures: HAC_KEYS.map((k) => {
        const m = hac.measures.find((x) => x.key === k)
        const z = m?.z_official ?? m?.z_rebuilt ?? null
        return {
          key: k,
          label: HAC_LABELS[k],
          category: m?.category ?? DEFAULT_CAT[k],
          value: m?.value ?? null,
          z,
          weight: m?.weight ?? 0,
          contribution: m?.contribution ?? (z != null && m ? z * m.weight : null),
          predicted: m?.predicted ?? null,
          observed: m?.observed ?? null,
        }
      }),
      ptp: hac.patients_to_prevent,
      tipping: hac.tipping_measure,
      cushion: hac.cushion_events,
    }
  }
  const t = h.trajectory
  const zMap = Object.fromEntries(t.measures.map((m) => [m.key, m.z])) as Partial<Record<HacMeasureKey, number | null>>
  const { weights } = totalScore(zMap)
  return {
    view: 'trajectory',
    label: 'Latest data, scored with the FY2026 rules (preview)',
    source: t.source,
    periodText: [{ label: 'Infections', period: t.period }],
    total: t.total,
    cutoff: hac?.cutoff ?? cutoff,
    gap: t.gap,
    status: t.status,
    measures: HAC_KEYS.map((k) => {
      const m = t.measures.find((x) => x.key === k)
      const cat = hac?.measures.find((x) => x.key === k)?.category ?? DEFAULT_CAT[k]
      const z = m?.z ?? null
      return {
        key: k,
        label: HAC_LABELS[k],
        category: cat,
        value: m?.value ?? null,
        z,
        weight: weights[k],
        contribution: z == null ? null : z * weights[k],
        predicted: m?.predicted ?? null,
        observed: m?.observed ?? null,
      }
    }),
    ptp: t.patients_to_prevent,
    tipping: t.tipping_measure,
    cushion: null,
  }
}

