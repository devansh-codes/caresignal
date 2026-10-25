import { describe, expect, it } from 'vitest'
import type { HacParams, Hospital, National } from './types'
import {
  type BaselineMeasure,
  baselineFrom,
  eventsToClear,
  eventsToCross,
  percentileOf,
  simulate,
  statusFor,
  totalScore,
  winsorize,
  zFromValue,
} from './simulate'

const params: HacParams = {
  fiscal_year: 2026,
  cutoff: 0.2,
  near_band: 2,
  measures: {
    psi90: { winsor_low: 0.8, winsor_high: 1.3, mean: 1.0, sd: 0.1, n: 100 },
    clabsi: { winsor_low: 0, winsor_high: 2, mean: 0.8, sd: 0.5, n: 100 },
    cauti: { winsor_low: 0, winsor_high: 2, mean: 0.8, sd: 0.5, n: 100 },
    ssi: { winsor_low: 0, winsor_high: 2, mean: 0.8, sd: 0.5, n: 100 },
    cdi: { winsor_low: 0, winsor_high: 2, mean: 0.8, sd: 0.5, n: 100 },
    mrsa: { winsor_low: 0, winsor_high: 2, mean: 0.8, sd: 0.5, n: 100 },
  },
}

const base = (over: Partial<Record<string, Partial<BaselineMeasure>>> = {}): BaselineMeasure[] =>
  (['psi90', 'clabsi', 'cauti', 'ssi', 'cdi', 'mrsa'] as const).map((key) => ({
    key,
    value: key === 'psi90' ? 1.0 : 0.8,
    predicted: key === 'psi90' ? null : 10,
    observed: key === 'psi90' ? null : 8,
    ...(over[key] ?? {}),
  }))

describe('core math', () => {
  it('winsorizes at the bounds', () => {
    expect(winsorize(5, 0, 2)).toBe(2)
    expect(winsorize(-1, 0, 2)).toBe(0)
    expect(winsorize(1, 0, 2)).toBe(1)
  })
  it('z uses the winsorized value', () => {
    expect(zFromValue('cauti', 3, params)).toBeCloseTo((2 - 0.8) / 0.5, 12)
    expect(zFromValue('cauti', null, params)).toBeNull()
  })
  it('weights equally over available measures', () => {
    const { total, weights } = totalScore({ psi90: 1, cauti: 2, clabsi: null, ssi: null, cdi: null, mrsa: 3 })
    expect(total).toBeCloseTo(2, 12)
    expect(weights.cauti).toBeCloseTo(1 / 3, 12)
    expect(weights.clabsi).toBe(0)
  })
  it('returns null total with no measures', () => {
    expect(totalScore({}).total).toBeNull()
  })
})

describe('simulate', () => {
  it('baseline at the mean gives total 0', () => {
    const r = simulate(base(), params, { prevented: {}, psi90Delta: 0 })
    expect(r.total).toBeCloseTo(0, 12)
    expect(r.gap).toBeCloseTo(-0.2, 12)
    expect(r.above).toBe(false)
  })
  it('SIR′ = SIR − N / predicted', () => {
    const r = simulate(base({ cauti: { value: 1.5 } }), params, { prevented: { cauti: 5 }, psi90Delta: 0 })
    expect(r.values.cauti).toBeCloseTo(1.0, 12)
    expect(r.z.cauti).toBeCloseTo(0.4, 12)
  })
  it('never goes below 0 SIR', () => {
    const r = simulate(base(), params, { prevented: { cauti: 100 }, psi90Delta: 0 })
    expect(r.values.cauti).toBe(0)
  })
  it('holds a CMS-assigned z when no value was submitted', () => {
    const r = simulate(base({ cdi: { value: null, zFixed: 2.5 } }), params, { prevented: {}, psi90Delta: 0 })
    expect(r.z.cdi).toBe(2.5)
    expect(r.weights.cdi).toBeCloseTo(1 / 6, 12)
    expect(r.total).toBeCloseTo(2.5 / 6, 12)
  })
  it('applies PSI 90 delta', () => {
    const r = simulate(base(), params, { prevented: {}, psi90Delta: -0.1 })
    expect(r.z.psi90).toBeCloseTo(-1, 12)
  })
})

describe('patients to prevent', () => {
  it('clears exactly at the cutoff', () => {
    // CAUTI SIR 2.0 → z 2.4; others at mean → total 0.4; gap 0.2; Δz = 0.2 / (1/6) = 1.2; ΔSIR = 0.6; events = ceil(6) = 6
    const b = base({ cauti: { value: 2.0, observed: 20 } })
    const s = simulate(b, params, { prevented: {}, psi90Delta: 0 })
    expect(s.total).toBeCloseTo(0.4, 12)
    const e = eventsToClear(b.find((x) => x.key === 'cauti')!, s.weights.cauti, s.gap!, params)
    expect(e.feasible).toBe(true)
    expect(e.events).toBe(6)
    const after = simulate(b, params, { prevented: { cauti: 6 }, psi90Delta: 0 })
    expect(after.gap!).toBeLessThanOrEqual(1e-12)
    const before = simulate(b, params, { prevented: { cauti: 5 }, psi90Delta: 0 })
    expect(before.gap!).toBeGreaterThan(0)
  })
  it('counts reduction above the Winsorization ceiling', () => {
    // SIR 3.0 is capped at 2.0; same z as above, but ΔSIR = 3.0 − 1.4 = 1.6 → 16 events
    const b = base({ cauti: { value: 3.0, observed: 30 } })
    const s = simulate(b, params, { prevented: {}, psi90Delta: 0 })
    const e = eventsToClear(b.find((x) => x.key === 'cauti')!, s.weights.cauti, s.gap!, params)
    expect(e.events).toBe(16)
  })
  it('flags infeasible when the floor is hit', () => {
    const b = base({ psi90: { value: 1.3 }, clabsi: { value: 2 }, cauti: { value: 0.1 }, ssi: { value: 2 }, cdi: { value: 2 }, mrsa: { value: 2 } })
    const s = simulate(b, params, { prevented: {}, psi90Delta: 0 })
    const e = eventsToClear(b.find((x) => x.key === 'cauti')!, s.weights.cauti, s.gap!, params)
    expect(e.feasible).toBe(false)
    expect(e.reason).toMatch(/floor/i)
  })
  it('cushion counts strictly-crossing events', () => {
    const b = base()
    const s = simulate(b, params, { prevented: {}, psi90Delta: 0 })
    // gap −0.2 → Δz 1.2 → ΔSIR 0.6 → 6 events lands exactly at the cutoff (not penalized); 7 crosses
    const e = eventsToCross(b.find((x) => x.key === 'cauti')!, s.weights.cauti, s.gap!, params)
    expect(e.events).toBe(7)
    expect(statusFor(s.gap, 7, 2)).toBe('clear')
    expect(statusFor(s.gap, 2, 2)).toBe('near')
    expect(statusFor(0.01, null, 2)).toBe('penalized')
  })
  it('percentile is mid-rank', () => {
    expect(percentileOf(50, [10, 20, 50, 60])).toBeCloseTo(62.5, 9)
    expect(percentileOf(50, [10, 20, 50, 60], false)).toBeCloseTo(37.5, 9)
  })
})

// --- Parity with the Python pipeline, using exported site JSON when it exists ---
// Vite globs resolve at transform time; they are empty (and the suite skips) before `make data`.
const nationalMods = import.meta.glob<National>('/public/data/national.json', { eager: true, import: 'default' })
// AL, AK, AZ, AR and CA facilities (CCN prefixes 01–05): several hundred hospitals, enough for parity.
const hospitalMods = import.meta.glob<Hospital>('/public/data/hospitals/0[1-5]*.json', { eager: true, import: 'default' })
const haveData = Object.keys(nationalMods).length > 0 && Object.keys(hospitalMods).length > 0

describe.skipIf(!haveData)('parity with exported pipeline data', () => {
  const national = Object.values(nationalMods)[0] as National
  const hospitals: Hospital[] = Object.values(hospitalMods).filter((h) => h.hac)

  it('has HAC-scored hospitals to test', () => {
    expect(hospitals.length).toBeGreaterThan(50)
  })

  it('official z × equal weights reproduces the official total within 1e-3', () => {
    let bad = 0
    for (const h of hospitals) {
      const z = Object.fromEntries(h.hac!.measures.map((m) => [m.key, m.z_official]))
      const { total } = totalScore(z)
      if (total == null || Math.abs(total - h.hac!.total) > 1e-3) bad++
    }
    expect(bad / hospitals.length).toBeLessThan(0.01)
  })

  // hac_params are the calibrated FY2026 parameters (recovered from official W Z scores), so the
  // client should reproduce the *official* z; z_rebuilt is the independent validation rebuild.
  it('client-side z from official values reproduces the official z within 1e-3', () => {
    let checked = 0, bad = 0
    for (const h of hospitals) {
      for (const m of h.hac!.measures) {
        if (m.value == null || m.z_official == null) continue
        checked++
        if (Math.abs((zFromValue(m.key, m.value, national.hac_params) as number) - m.z_official) > 1e-3) bad++
      }
    }
    expect(checked).toBeGreaterThan(100)
    expect(bad / checked).toBeLessThan(0.01)
  })

  it('cushion matches the pipeline for clear hospitals', () => {
    let checked = 0
    const mismatches: string[] = []
    for (const h of hospitals) {
      const hac = h.hac!
      if (hac.gap > 0 || !hac.cushion_events) continue
      const b = baselineFrom(hac)
      const { weights } = totalScore(Object.fromEntries(hac.measures.map((m) => [m.key, m.z_official])))
      for (const p of hac.cushion_events) {
        if (!p.feasible || p.events == null) continue
        const r = eventsToCross(b.find((x) => x.key === p.measure)!, weights[p.measure], hac.gap, national.hac_params)
        checked++
        if (r.events !== p.events) mismatches.push(`${h.ccn}/${p.measure}: ts=${r.events} py=${p.events}`)
      }
    }
    expect(checked).toBeGreaterThan(50)
    expect(mismatches.length / checked, mismatches.slice(0, 10).join('; ')).toBeLessThan(0.01)
  })

  it('zero-change simulation reproduces the official total', () => {
    let bad = 0
    for (const h of hospitals) {
      const r = simulate(baselineFrom(h.hac!), national.hac_params, { prevented: {}, psi90Delta: 0 })
      if (r.total == null || Math.abs(r.total - h.hac!.total) > 2e-3) bad++
    }
    expect(bad / hospitals.length).toBeLessThan(0.01)
  })

  it('patients-to-prevent matches the pipeline for every HAI measure', () => {
    let checked = 0
    const mismatches: string[] = []
    for (const h of hospitals) {
      const hac = h.hac!
      if (hac.gap <= 0) continue
      const b = baselineFrom(hac)
      const zOff = Object.fromEntries(hac.measures.map((m) => [m.key, m.z_official]))
      const { weights } = totalScore(zOff)
      for (const p of hac.patients_to_prevent) {
        if (p.measure === 'psi90' || !p.feasible || p.events == null) continue
        const r = eventsToClear(b.find((x) => x.key === p.measure)!, weights[p.measure], hac.gap, national.hac_params)
        checked++
        if (r.events !== p.events) mismatches.push(`${h.ccn}/${p.measure}: ts=${r.events} py=${p.events}`)
      }
    }
    expect(checked).toBeGreaterThan(20)
    expect(mismatches.length / checked, mismatches.slice(0, 10).join('; ')).toBeLessThan(0.01)
  })
})
