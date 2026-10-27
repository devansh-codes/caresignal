import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { StateView } from '../components/ui'
import { loadHospital, loadManifest, loadMeasures, loadNational, loadPeers, useData, type AsyncState } from '../lib/data'
import type { Manifest, Measures, National, PeerFile } from '../lib/types'
import { Accordion, HospitalProvider, Panel, Step } from '../components/hospital/shared'
import { plain, type HacView } from '../components/hospital/helpers'
import { buildViewModel } from '../components/hospital/viewModel'
import HospitalHeader from '../components/hospital/HospitalHeader'
import StandingStats from '../components/hospital/StandingStats'
import PenaltyGauge from '../components/hospital/PenaltyGauge'
import HacWaterfall from '../components/hospital/HacWaterfall'
import PatientsToPrevent from '../components/hospital/PatientsToPrevent'
import WhatIfPanel from '../components/hospital/WhatIfPanel'
import PeerDistribution from '../components/hospital/PeerDistribution'
import HcahpsCard from '../components/hospital/HcahpsCard'
import HaiTable from '../components/hospital/HaiTable'
import ReadmissionTable from '../components/hospital/ReadmissionTable'
import { SafetyIndicators, SepsisAndVbp } from '../components/hospital/AdditionalMeasures'
import NoHacNotice from '../components/hospital/NoHacNotice'
import PrintBrief from '../components/hospital/PrintBrief'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'infections', label: 'Infections' },
  { id: 'experience', label: 'Patient experience' },
  { id: 'readmissions', label: 'Readmissions' },
  { id: 'whatif', label: 'Try a what if' },
] as const
type TabId = (typeof TABS)[number]['id']

/** Optional side data: failures here degrade a section, never the whole page. */
function useOptional<T>(loader: () => Promise<T>, deps: unknown[]): T | null {
  const s = useData(loader, deps)
  return s.status === 'ready' ? s.data : null
}

/** Reference style tab row: plain text tabs, navy underline on the active one. Arrow keys move between tabs. */
function Tabs({ active, onChange, hideWhatIf }: { active: TabId; onChange: (t: TabId) => void; hideWhatIf: boolean }) {
  const tabs = TABS.filter((t) => !(hideWhatIf && t.id === 'whatif'))
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + tabs.length) % tabs.length
    onChange(tabs[n].id)
    refs.current[n]?.focus()
  }
  return (
    <div className="no-print sticky top-0 z-20 -mx-4 border-b border-[#C9D2E3] bg-bg/95 px-4 backdrop-blur sm:mx-0 sm:px-0">
      <div role="tablist" aria-label="Hospital sections" className="flex gap-6 overflow-x-auto whitespace-nowrap sm:gap-10">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            type="button"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px border-b-4 py-4 text-[17px] font-bold transition ${
              active === t.id ? 'border-[#112659] text-ink' : 'border-transparent text-muted hover:border-[#FECA71] hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
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
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (t: TabId) => {
    const next = new URLSearchParams(params)
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (hs.status === 'ready') document.title = `${plain(hs.data.name)} | CareSignal`
    return () => {
      document.title = 'CareSignal | Hospital Quality Penalty Radar'
    }
  }, [hs])
  useEffect(() => setView('program'), [ccn])

  const vm = useMemo(
    () => (hs.status === 'ready' ? buildViewModel(hs.data, view, national?.hac_params.cutoff ?? 0) : null),
    [hs, view, national],
  )

  if (!valid || (hs.status === 'error' && /404|invalid/.test(hs.error)))
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-3xl font-bold text-ink">We could not find that hospital</h1>
        <p className="mt-3 text-[15px] text-muted">
          No hospital with the Medicare ID <span className="font-semibold text-ink">{ccn}</span> is in the current CMS hospital list. Medicare IDs have 6 characters, for example 010001.
        </p>
        <Link to="/hospitals" className="mt-6 inline-block bg-[#FECA71] px-5 py-2.5 text-[15px] font-bold text-[#112659]">See all hospitals</Link>
      </div>
    )
  if (hs.status === 'loading') return <StateView kind="loading" />
  if (hs.status === 'error') return <StateView kind="error" message="This hospital’s data could not be loaded. Please refresh the page or try again later." />

  const h = hs.data
  const nurse = h.hcahps?.items.find((i) => i.id === 'H_COMP_1_A_P')
  const peerNurse = peers?.status === 'ready' ? (peers.data.values['nurse_comm'] ?? null) : null
  const natNurse = national ? national.scatter_nurse_comm_vs_hac.map((p) => p.x) : null
  const activeTab = !vm && tab === 'whatif' ? 'overview' : tab

  return (
    <HospitalProvider value={{ hospital: h, national, measures }}>
      <div className="print:hidden">
        <HospitalHeader h={h} />
        <div className="mt-6">
          <Tabs active={activeTab} onChange={setTab} hideWhatIf={!vm} />
        </div>

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="space-y-6 pt-8">
          {activeTab === 'overview' &&
            (vm ? (
              <>
                <section aria-labelledby="step1">
                  <Step n={1} id="step1" title="Where this hospital stands" intro="Medicare gives each hospital a safety score. The worst 25% of hospitals are above the penalty line and lose 1% of their Medicare payments for the year." />
                  <Panel className="space-y-8">
                    <StandingStats h={h} />
                    <div className="border-t border-[#C9D2E3] pt-6">
                      <PenaltyGauge vm={vm} national={national} percentile={h.hac?.percentile ?? null} />
                    </div>
                  </Panel>
                </section>

                <section aria-labelledby="step2">
                  <Step n={2} id="step2" title="What is driving the score" intro="The score is built from six safety measures. This shows which ones push the score up and which ones bring it down." />
                  <Panel><HacWaterfall vm={vm} onView={setView} hasTrajectory={!!h.trajectory && !!h.hac} /></Panel>
                </section>

                <section aria-labelledby="step3">
                  <Step
                    n={3}
                    id="step3"
                    title={vm.gap != null && vm.gap > 0 ? 'What would bring it below the line' : 'How much room it has'}
                    intro={vm.gap != null && vm.gap > 0 ? 'Turning the score into patients: how many fewer infections of one type would clear the line.' : 'Turning the score into patients: how many more infections of one type would push it over the line.'}
                  />
                  <Panel><PatientsToPrevent vm={vm} /></Panel>
                  <p className="mt-3 text-[15px] text-ink">
                    Want to test your own numbers?{' '}
                    <button type="button" onClick={() => setTab('whatif')} className="font-bold underline decoration-[#FECA71] decoration-2 underline-offset-4">Try a what if →</button>
                  </p>
                </section>

                <div className="space-y-3 pt-2">
                  <Accordion title="Compare with similar hospitals"><PeerDistribution h={h} peers={peers} groupId="hac" /></Accordion>
                  <Accordion title="See the separate patient safety problems"><SafetyIndicators h={h} /></Accordion>
                </div>
              </>
            ) : (
              <>
                <NoHacNotice h={h} />
                <div className="space-y-3">
                  <Accordion title="See the separate patient safety problems"><SafetyIndicators h={h} /></Accordion>
                </div>
              </>
            ))}

          {activeTab === 'infections' && (
            <>
              <HaiTable h={h} />
              <Accordion title="See the separate patient safety problems"><SafetyIndicators h={h} /></Accordion>
            </>
          )}

          {activeTab === 'experience' && (
            <>
              <HcahpsCard h={h} />
              <Accordion title="Compare with similar hospitals"><PeerDistribution h={h} peers={peers} groupId="experience" /></Accordion>
            </>
          )}

          {activeTab === 'readmissions' && (
            <>
              <ReadmissionTable h={h} />
              <Accordion title="Sepsis care and other Medicare quality scores"><SepsisAndVbp h={h} /></Accordion>
            </>
          )}

          {activeTab === 'whatif' && vm && (
            <section aria-labelledby="whatif-h">
              <div className="mb-4">
                <h2 id="whatif-h" className="text-2xl font-bold text-ink sm:text-[28px]">Try a what if</h2>
                <p className="mt-1 max-w-3xl text-[15px] text-muted">See how preventing a few infections, or improving nurse communication, would change this hospital’s position.</p>
              </div>
              <Panel>
                {national ? (
                  <WhatIfPanel key={`${h.ccn}-${vm.view}`} vm={vm} params={national.hac_params} nurse={nurse} nursePeerValues={peerNurse} nurseNationalValues={natNurse} />
                ) : (
                  <StateView kind="loading" />
                )}
              </Panel>
            </section>
          )}
        </div>
      </div>
      <PrintBrief h={h} manifest={manifest} />
    </HospitalProvider>
  )
}
