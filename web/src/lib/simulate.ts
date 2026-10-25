/**
 * Client-side mirror of pipeline/hac_core.py: winsorize → z-score → equal weights → Total HAC Score,
 * plus patients-to-prevent / cushion math. Keep this file numerically identical to the Python;
 * simulate.test.ts checks it against exported hospital JSON.
 */
import type { HacBlock, HacMeasureKey, HacParams, HacStatus, TrajectoryBlock } from './types'

export const HAC_KEYS: HacMeasureKey[] = ['psi90', 'clabsi', 'cauti', 'ssi', 'cdi', 'mrsa']
export const HAI_KEYS: HacMeasureKey[] = ['clabsi', 'cauti', 'ssi', 'cdi', 'mrsa']
const EPS = 1e-9

export const winsorize = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
export const zscore = (w: number, mean: number, sd: number) => (w - mean) / sd

/** Equal weights over the measures that have a result (z != null). */
export function totalScore(z: Partial<Record<HacMeasureKey, number | null>>): { total: number | null; weights: Record<HacMeasureKey, number> } {
  const have = HAC_KEYS.filter((k) => z[k] != null && Number.isFinite(z[k] as number))
  const w = have.length ? 1 / have.length : 0
  const weights = Object.fromEntries(HAC_KEYS.map((k) => [k, have.includes(k) ? w : 0])) as Record<HacMeasureKey, number>
  if (!have.length) return { total: null, weights }
  return { total: have.reduce((s, k) => s + (z[k] as number) * w, 0), weights }
}

export function zFromValue(key: HacMeasureKey, value: number | null, params: HacParams): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const p = params.measures[key]
  return zscore(winsorize(value, p.winsor_low, p.winsor_high), p.mean, p.sd)
}

export interface BaselineMeasure {
  key: HacMeasureKey
  value: number | null // PSI 90 composite or SIR
  predicted: number | null
  observed: number | null
  /** z CMS assigned with no measure value (required data not submitted → max z); held constant. */
  zFixed?: number | null
}

/** Pull the simulator baseline from either view. Program year uses official values; trajectory uses current-file values. */
export function baselineFrom(view: HacBlock | TrajectoryBlock): BaselineMeasure[] {
  return HAC_KEYS.map((key) => {
    const m = view.measures.find((x) => x.key === key)
    const z = m && 'z_official' in m ? (m.z_official ?? m.z_rebuilt) : (m?.z ?? null)
    return { key, value: m?.value ?? null, predicted: m?.predicted ?? null, observed: m?.observed ?? null, zFixed: m?.value == null ? (z ?? null) : null }
  })
}

export interface Scenario {
  /** Infections prevented (positive) per HAI measure. */
  prevented: Partial<Record<HacMeasureKey, number>>
  /** Absolute change to the PSI 90 composite value (negative = better). */
  psi90Delta: number
}

export interface SimResult {
  values: Record<HacMeasureKey, number | null>
  z: Record<HacMeasureKey, number | null>
  weights: Record<HacMeasureKey, number>
  contributions: Record<HacMeasureKey, number | null>
  total: number | null
  gap: number | null
  above: boolean | null
}

/** SIR' = SIR − N / Predicted  (equivalently (O − N) / P), floored at 0. */
export function simulate(base: BaselineMeasure[], params: HacParams, s: Scenario): SimResult {
  const values = {} as Record<HacMeasureKey, number | null>
  const z = {} as Record<HacMeasureKey, number | null>
  for (const b of base) {
    let v = b.value
    if (v != null) {
      if (b.key === 'psi90') v = Math.max(0, v + (s.psi90Delta || 0))
      else {
        const n = s.prevented[b.key] ?? 0
        if (n && b.predicted && b.predicted > 0) v = Math.max(0, v - n / b.predicted)
      }
    }
    values[b.key] = v
    z[b.key] = v == null ? (b.zFixed ?? null) : zFromValue(b.key, v, params)
  }
  const { total, weights } = totalScore(z)
  const contributions = Object.fromEntries(
    HAC_KEYS.map((k) => [k, z[k] == null ? null : (z[k] as number) * weights[k]]),
  ) as Record<HacMeasureKey, number | null>
  const gap = total == null ? null : total - params.cutoff
  return { values, z, weights, contributions, total, gap, above: gap == null ? null : gap > 0 }
}

export interface EventsResult {
  events: number | null
  deltaValue: number | null
  feasible: boolean
  reason: string | null
}

/**
 * Infections to prevent in one measure to bring the total to ≤ cutoff (all else constant).
 * Δz = gap / weight; target winsorized value W' = W − Δz·SD; if W' < winsor_low the measure alone cannot clear.
 * ΔSIR = SIR − W' (includes any portion above the Winsorization ceiling); events = ceil(ΔSIR × Predicted).
 */
export function eventsToClear(b: BaselineMeasure, weight: number, gap: number, params: HacParams): EventsResult {
  if (gap <= 0) return { events: 0, deltaValue: 0, feasible: true, reason: 'Already clear' }
  if (b.value == null || weight <= 0) return { events: null, deltaValue: null, feasible: false, reason: 'No result for this measure' }
  const p = params.measures[b.key]
  const w = winsorize(b.value, p.winsor_low, p.winsor_high)
  const target = w - (gap / weight) * p.sd
  if (target < p.winsor_low - EPS) return { events: null, deltaValue: null, feasible: false, reason: 'Winsorization floor reached — this measure alone cannot clear the cutoff' }
  const deltaValue = b.value - target
  if (b.key === 'psi90') return { events: null, deltaValue, feasible: true, reason: 'PSI 90 is a composite rate; event count not derivable' }
  if (!b.predicted || b.predicted <= 0) return { events: null, deltaValue, feasible: false, reason: 'No predicted infection count' }
  // Same as hac_core.events_from_sir_change + metrics.patients_to_prevent: ceil, at least 1.
  return { events: Math.max(1, Math.ceil(deltaValue * b.predicted - EPS)), deltaValue, feasible: true, reason: null }
}

/** Added infections in one measure that would push a clear hospital above the cutoff. */
export function eventsToCross(b: BaselineMeasure, weight: number, gap: number, params: HacParams): EventsResult {
  if (gap > 0) return { events: 0, deltaValue: 0, feasible: true, reason: 'Already above cutoff' }
  if (b.value == null || weight <= 0) return { events: null, deltaValue: null, feasible: false, reason: 'No result for this measure' }
  const p = params.measures[b.key]
  const w = winsorize(b.value, p.winsor_low, p.winsor_high)
  const margin = -gap + EPS // strictly above the cutoff (metrics.cushion_events)
  const target = w + (margin / weight) * p.sd
  if (target > p.winsor_high + EPS) return { events: null, deltaValue: null, feasible: false, reason: 'Winsorization ceiling reached — this measure alone cannot cross the cutoff' }
  const deltaValue = target - b.value
  if (b.key === 'psi90') return { events: null, deltaValue, feasible: true, reason: 'PSI 90 is a composite rate; event count not derivable' }
  if (!b.predicted || b.predicted <= 0) return { events: null, deltaValue, feasible: false, reason: 'No predicted infection count' }
  return { events: Math.max(1, Math.ceil(deltaValue * b.predicted - EPS)), deltaValue, feasible: true, reason: null }
}

export function statusFor(gap: number | null, minCushion: number | null, nearBand: number): HacStatus {
  if (gap == null) return 'no_score'
  if (gap > 0) return 'penalized'
  return minCushion != null && minCushion <= nearBand ? 'near' : 'clear'
}

/** Min added infections (over HAI measures) to cross the cutoff; null if none computable. */
export function minCushion(base: BaselineMeasure[], sim: SimResult, params: HacParams): number | null {
  if (sim.gap == null || sim.gap > 0) return null
  const simBase = base.map((b) => ({ ...b, value: sim.values[b.key] }))
  const ev = HAI_KEYS.map((k) => eventsToCross(simBase.find((b) => b.key === k)!, sim.weights[k], sim.gap!, params))
    .filter((e) => e.feasible && e.events != null)
    .map((e) => e.events as number)
  return ev.length ? Math.min(...ev) : null
}

/** Mid-rank percentile (0–100, higher = better when higherBetter). */
export function percentileOf(v: number | null, population: (number | null)[], higherBetter = true): number | null {
  if (v == null) return null
  const xs = population.filter((x): x is number => x != null && Number.isFinite(x))
  if (!xs.length) return null
  let below = 0, equal = 0
  for (const x of xs) {
    if (Math.abs(x - v) < 1e-9) equal++
    else if (higherBetter ? x < v : x > v) below++
  }
  return (100 * (below + 0.5 * equal)) / xs.length
}
