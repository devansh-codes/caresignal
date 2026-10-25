import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StateView } from '../components/ui'
import { loadHospital, loadManifest, loadMeasures, loadNational, loadPeers, useData, type AsyncState } from '../lib/data'
import type { Manifest, Measures, National, PeerFile } from '../lib/types'
import { HospitalProvider } from '../components/hospital/shared'
import type { HacView } from '../components/hospital/helpers'
import { buildViewModel } from '../components/hospital/viewModel'
import HospitalHeader from '../components/hospital/HospitalHeader'
import KpiRow from '../components/hospital/KpiRow'
import PenaltyGauge from '../components/hospital/PenaltyGauge'
import HacWaterfall from '../components/hospital/HacWaterfall'
import PatientsToPrevent from '../components/hospital/PatientsToPrevent'
import WhatIfPanel from '../components/hospital/WhatIfPanel'
import PeerDistribution from '../components/hospital/PeerDistribution'
import HcahpsCard from '../components/hospital/HcahpsCard'
import HaiTable from '../components/hospital/HaiTable'
import ReadmissionTable from '../components/hospital/ReadmissionTable'
import AdditionalMeasures from '../components/hospital/AdditionalMeasures'
import NoHacNotice from '../components/hospital/NoHacNotice'
import PrintBrief from '../components/hospital/PrintBrief'

const SECTIONS = [
  { id: 'status', label: 'Status' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'actions', label: 'Actions' },
  { id: 'experience', label: 'Patient experience' },
  { id: 'outcomes', label: 'Infections & readmissions' },
  { id: 'more', label: 'More measures' },
]

/** Optional side data: failures here degrade a card, never the whole page. */
function useOptional<T>(loader: () => Promise<T>, deps: unknown[]): T | null {
  const s = useData(loader, deps)
  return s.status === 'ready' ? s.data : null
}

export default function Hospital() {
  const { ccn = '' } = useParams()
  const valid = /^[0-9A-Z]{6}$/i.test(ccn)
  const hs = useData(() => (valid ? loadHospital(ccn.toUpperCase()) : Promise.reject(new Error('invalid'))), [ccn])
  const national = useOptional<National>(loadNational, [])
  const measures = useOptional<Measures>(loadMeasures, [])
  const manifest = useOptional<Manifest>(loadManifest, [])
  const peerKey = hs.status === 'ready' ? (hs.data.peer?.key ?? null) : null
  const peerState = useData<PeerFile | null>(() => (peerKey ? loadPeers(peerKey) : Promise.resolve(null)), [peerKey])
  const peers: AsyncState<PeerFile> | null =
    !peerKey ? null : peerState.status === 'ready' ? (peerState.data ? { status: 'ready', data: peerState.data } : null) : peerState
  const [view, setView] = useState<HacView>('program')

  useEffect(() => {
    if (hs.status === 'ready') document.title = `${hs.data.name} — CareSignal`
    return () => {
      document.title = 'CareSignal — Hospital Quality Penalty Radar'
    }
  }, [hs])
  useEffect(() => setView('program'), [ccn])

  const vm = useMemo(
    () => (hs.status === 'ready' ? buildViewModel(hs.data, view, national?.hac_params.cutoff ?? 0) : null),
    [hs, view, national],
  )

  if (!valid || (hs.status === 'error' && /404|invalid/.test(hs.error)))
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <h1 className="text-2xl font-bold text-ink">Hospital not found</h1>
        <p className="mt-2 text-sm text-muted">
          No CMS facility with CCN <span className="font-mono text-ink">{ccn}</span> appears in the current Hospital General Information file. CCNs are 6 characters,
          for example 010001.
        </p>
        <Link to="/hospitals" className="mt-4 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-ink">Browse all hospitals</Link>
      </div>
    )
  if (hs.status === 'loading') return <StateView kind="loading" />
  if (hs.status === 'error') return <StateView kind="error" message={`This hospital's data could not be loaded (${hs.error}).`} />

  const h = hs.data
  const nurse = h.hcahps?.items.find((i) => i.id === 'H_COMP_1_A_P')
  const peerNurse = peers?.status === 'ready' ? (peers.data.values['nurse_comm'] ?? null) : null
  const natNurse = national ? national.scatter_nurse_comm_vs_hac.map((p) => p.x) : null

  return (
    <HospitalProvider value={{ hospital: h, national, measures }}>
      <div className="print:hidden">
        <HospitalHeader h={h} />

        <nav aria-label="On this page" className="no-print -mx-4 mb-5 overflow-x-auto border-y border-border bg-surface/80 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-card sm:border">
          <ul className="flex gap-1 whitespace-nowrap text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                  className="rounded px-2.5 py-1 text-muted hover:bg-surface-2 hover:text-ink">{s.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-5">
          <section id="status" aria-labelledby="status-h" className="scroll-mt-20 space-y-4">
            <h2 id="status-h" className="sr-only">Penalty status</h2>
            <KpiRow h={h} />
            {vm ? <PenaltyGauge vm={vm} national={national} percentile={h.hac?.percentile ?? null} /> : <NoHacNotice h={h} />}
          </section>

          {vm && (
            <>
              <section id="drivers" aria-labelledby="drivers-h" className="scroll-mt-20">
                <h2 id="drivers-h" className="sr-only">Score drivers</h2>
                <HacWaterfall vm={vm} onView={setView} hasTrajectory={!!h.trajectory && !!h.hac} />
              </section>
              <section id="actions" aria-labelledby="actions-h" className="scroll-mt-20 space-y-5">
                <h2 id="actions-h" className="sr-only">Actions</h2>
                <PatientsToPrevent vm={vm} />
                {national ? (
                  <WhatIfPanel key={`${h.ccn}-${vm.view}`} vm={vm} params={national.hac_params} nurse={nurse} nursePeerValues={peerNurse} nurseNationalValues={natNurse} />
                ) : (
                  <StateView kind="loading" />
                )}
              </section>
            </>
          )}

          <section id="experience" aria-labelledby="exp-h" className="scroll-mt-20 space-y-5">
            <h2 id="exp-h" className="sr-only">Patient experience and peers</h2>
            <HcahpsCard h={h} />
            <PeerDistribution h={h} peers={peers} />
          </section>

          <section id="outcomes" aria-labelledby="out-h" className="scroll-mt-20 grid grid-cols-1 gap-5">
            <h2 id="out-h" className="sr-only">Infections and readmissions</h2>
            <HaiTable h={h} />
            <ReadmissionTable h={h} />
          </section>

          <section id="more" aria-labelledby="more-h" className="scroll-mt-20">
            <h2 id="more-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Additional measures</h2>
            <AdditionalMeasures h={h} />
          </section>
        </div>
      </div>
      <PrintBrief h={h} manifest={manifest} />
    </HospitalProvider>
  )
}
