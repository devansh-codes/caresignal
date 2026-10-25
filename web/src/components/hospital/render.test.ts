/**
 * Server-render smoke test: every hospital-view component renders against real exported JSON
 * for penalized, near, clear and no-HAC hospitals, in both HAC views. Skips before `make data`.
 */
import { createElement as h, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Hospital, Measures, National } from '../../lib/types'
import { HospitalProvider } from './shared'
import { buildViewModel } from './viewModel'
import HospitalHeader from './HospitalHeader'
import KpiRow from './KpiRow'
import PenaltyGauge from './PenaltyGauge'
import HacWaterfall from './HacWaterfall'
import PatientsToPrevent from './PatientsToPrevent'
import WhatIfPanel from './WhatIfPanel'
import PeerDistribution from './PeerDistribution'
import HcahpsCard from './HcahpsCard'
import HaiTable from './HaiTable'
import ReadmissionTable from './ReadmissionTable'
import AdditionalMeasures from './AdditionalMeasures'
import NoHacNotice from './NoHacNotice'
import PrintBrief from './PrintBrief'

const nationalMods = import.meta.glob<National>('/public/data/national.json', { eager: true, import: 'default' })
const measuresMods = import.meta.glob<Measures>('/public/data/measures.json', { eager: true, import: 'default' })
const hospitalMods = import.meta.glob<Hospital>('/public/data/hospitals/{19*,24*,42*,05015F}.json', { eager: true, import: 'default' })
const haveData = Object.keys(nationalMods).length > 0 && Object.keys(hospitalMods).length > 0

beforeAll(() => {
  // token() reads CSS variables; give SSR a minimal document so it falls back to a neutral color.
  const g = globalThis as Record<string, unknown>
  g.document ??= { documentElement: {} }
  g.getComputedStyle ??= () => ({ getPropertyValue: () => '' })
})

describe.skipIf(!haveData)('hospital view renders with real data', () => {
  const national = Object.values(nationalMods)[0] as National
  const measures = (Object.values(measuresMods)[0] ?? null) as Measures | null
  const all = Object.values(hospitalMods)
  const pick = (f: (x: Hospital) => boolean) => all.find(f)
  const cases: [string, Hospital | undefined][] = [
    ['penalized', pick((x) => x.hac?.status === 'penalized')],
    ['near', pick((x) => x.hac?.status === 'near')],
    ['clear', pick((x) => x.hac?.status === 'clear')],
    ['no HAC', pick((x) => !x.hac)],
    ['assigned max z (value missing)', pick((x) => !!x.hac?.measures.some((m) => m.value == null && m.z_official != null))],
  ]

  for (const [name, hosp] of cases) {
    it(`renders: ${name}`, () => {
      if (!hosp) return // case not present in this sample
      const views = hosp.hac ? (hosp.trajectory ? (['program', 'trajectory'] as const) : (['program'] as const)) : []
      const parts: ReactElement[] = [h(HospitalHeader, { h: hosp }), h(KpiRow, { h: hosp })]
      for (const v of views) {
        const vm = buildViewModel(hosp, v, national.hac_params.cutoff)!
        expect(vm).not.toBeNull()
        parts.push(
          h(PenaltyGauge, { vm, national, percentile: hosp.hac?.percentile ?? null }),
          h(HacWaterfall, { vm, onView: () => {}, hasTrajectory: !!hosp.trajectory }),
          h(PatientsToPrevent, { vm }),
          h(WhatIfPanel, { vm, params: national.hac_params, nurse: hosp.hcahps?.items.find((i) => i.id === 'H_COMP_1_A_P'), nursePeerValues: null, nurseNationalValues: national.scatter_nurse_comm_vs_hac.map((p) => p.x) }),
        )
      }
      if (!hosp.hac) parts.push(h(NoHacNotice, { h: hosp }))
      parts.push(
        h(PeerDistribution, { h: hosp, peers: null }),
        h(HcahpsCard, { h: hosp }),
        h(HaiTable, { h: hosp }),
        h(ReadmissionTable, { h: hosp }),
        h(AdditionalMeasures, { h: hosp }),
        h(PrintBrief, { h: hosp, manifest: null }),
      )
      const html = renderToString(h(MemoryRouter, null, h(HospitalProvider, { value: { hospital: hosp, national, measures }, children: parts })))
      expect(html).toContain(hosp.name.replace(/&/g, '&amp;'))
      expect(html).not.toMatch(/NaN|undefined|\[object Object\]/)
    })
  }
})
