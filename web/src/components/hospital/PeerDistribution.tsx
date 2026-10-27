import type { EChartsOption } from 'echarts'
import { StateView } from '../ui'
import { plain } from './helpers'
import { Chart } from '../charts/Chart'
import { baseOption } from '../charts/theme'
import { fmt, token } from '../../lib/format'
import type { Hospital, PeerFile } from '../../lib/types'
import { percentileOf } from '../../lib/simulate'
import type { AsyncState } from '../../lib/data'

interface MetricDef { id: string; label: string; higherBetter: boolean; digits: number }
const GROUPS: { id: string; label: string; metrics: MetricDef[] }[] = [
  {
    id: 'hac',
    label: 'Safety score',
    metrics: [
      { id: 'hac_total', label: 'Safety score', higherBetter: false, digits: 2 },
      { id: 'cauti_value', label: 'Catheter infections (rate vs expected)', higherBetter: false, digits: 2 },
      { id: 'clabsi_value', label: 'Central line infections (rate vs expected)', higherBetter: false, digits: 2 },
      { id: 'cdi_value', label: 'C. diff infections (rate vs expected)', higherBetter: false, digits: 2 },
      { id: 'mrsa_value', label: 'MRSA bloodstream infections (rate vs expected)', higherBetter: false, digits: 2 },
      { id: 'ssi_value', label: 'Surgical site infections (rate vs expected)', higherBetter: false, digits: 2 },
      { id: 'psi90_value', label: 'Patient safety events (combined rate)', higherBetter: false, digits: 3 },
    ],
  },
  {
    id: 'experience',
    label: 'Patient experience and readmissions',
    metrics: [
      { id: 'nurse_comm', label: 'Nurse communication (% always)', higherBetter: true, digits: 0 },
      { id: 'discharge_info', label: 'Discharge information (% yes)', higherBetter: true, digits: 0 },
      { id: 'hcahps_star', label: 'Survey star rating', higherBetter: true, digits: 0 },
      { id: 'err_hf', label: 'Heart failure readmission ratio', higherBetter: false, digits: 2 },
      { id: 'err_pn', label: 'Pneumonia readmission ratio', higherBetter: false, digits: 2 },
      { id: 'err_copd', label: 'COPD readmission ratio', higherBetter: false, digits: 2 },
      { id: 'err_ami', label: 'Heart attack readmission ratio', higherBetter: false, digits: 2 },
    ],
  },
]

const jitter = (i: number) => (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.7

function median(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function Strip({ peer, idx, m }: { peer: PeerFile; idx: number; m: MetricDef }) {
  const vals = peer.values[m.id] ?? []
  const self = idx >= 0 ? (vals[idx] ?? null) : null
  const pts = vals
    .map((v, i) => (v == null || i === idx ? null : [v, jitter(i), peer.hospitals[i]]))
    .filter(Boolean) as [number, number, string][]
  const all = vals.filter((v): v is number => v != null)
  const med = median(all)
  const pct = percentileOf(self, vals, m.higherBetter)
  const b = baseOption()
  const option: EChartsOption = {
    ...b,
    grid: { left: 4, right: 12, top: 6, bottom: 22, containLabel: true },
    xAxis: { ...(b.xAxis as object), type: 'value', scale: true, splitLine: { show: false }, axisLabel: { color: token('muted'), fontSize: 10 } },
    yAxis: { type: 'value', min: -0.6, max: 0.6, show: false },
    tooltip: { ...(b.tooltip as object), trigger: 'item', formatter: (p: unknown) => {
      const d = (p as { data: (number | string)[]; seriesName: string }).data
      return `${(p as { seriesName: string }).seriesName === 'This hospital' ? '<b>This hospital</b>' : 'A similar hospital'}<br/>${m.label}: ${fmt(d[0] as number, m.digits)}`
    } },
    series: [
      {
        type: 'scatter',
        name: 'Peers',
        data: pts,
        symbolSize: 6,
        itemStyle: { color: 'rgba(88,144,168,0.45)' },
        markLine: med == null ? undefined : { silent: true, symbol: 'none', data: [{ xAxis: med }], lineStyle: { color: token('ink'), width: 1.5, type: 'solid' }, label: { formatter: `Middle ${fmt(med, m.digits)}`, position: 'end', color: token('muted'), fontSize: 10 } },
      },
      ...(self == null
        ? []
        : [{ type: 'scatter' as const, name: 'This hospital', data: [[self, 0, 'self']], symbolSize: 14, z: 5, itemStyle: { color: '#112659', borderColor: '#FFFFFF', borderWidth: 2 } }]),
    ],
  }
  return (
    <div className="border-b border-border/60 py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-ink">{m.label}</span>
        <span className="tabular text-xs text-muted">
          {self == null ? 'Not reported for this hospital' : <>This hospital <strong className="text-ink">{fmt(self, m.digits)}</strong> · {pct == null ? 'no comparison available' : `better than ${Math.round(pct)}% of similar hospitals`} ({m.higherBetter ? 'higher' : 'lower'} is better)</>}
        </span>
      </div>
      {all.length ? <Chart option={option} height={72} ariaLabel={`${m.label}: this hospital ${fmt(self, m.digits)} compared with ${all.length} similar hospitals, middle value ${fmt(med, m.digits)}.`} /> : <p className="py-2 text-xs text-muted">No values from similar hospitals.</p>}
    </div>
  )
}

/** Dot strips: every similar hospital as a light dot, this hospital in navy, the middle value as a line. */
export default function PeerDistribution({ h, peers, groupId }: { h: Hospital; peers: AsyncState<PeerFile> | null; groupId: 'hac' | 'experience' }) {
  const g = GROUPS.find((x) => x.id === groupId)!
  return (
    <div>
      <p className="mb-3 text-[15px] text-muted">
        {h.peer
          ? `Each light dot is one of ${h.peer.n} similar hospitals (${plain(h.peer.label)}). Hospitals are never named. The navy dot is this hospital.`
          : 'This hospital has no group of similar hospitals, because its size data is not available.'}
      </p>
      <ul className="mb-1 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink" aria-label="Chart key">
        <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3.5 w-3.5 rounded-full bg-[#112659]" />This hospital</li>
        <li className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#5890A8]/50" />A similar hospital</li>
        <li className="inline-flex items-center gap-2"><span aria-hidden className="h-4 w-0.5 bg-ink" />Middle value</li>
      </ul>
      {!h.peer || !peers ? null : peers.status === 'loading' ? (
        <StateView kind="loading" />
      ) : peers.status === 'error' ? (
        <StateView kind="error" message="Similar hospital data could not be loaded. Please try again later." />
      ) : (
        <div>{g.metrics.map((m) => <Strip key={m.id} peer={peers.data} idx={peers.data.hospitals.indexOf(h.ccn)} m={m} />)}</div>
      )}
      <p className="mt-4 text-xs text-muted">Source: similar hospitals are grouped by number of beds, teaching status, city or rural location and region of the country (CMS Hospital Cost Report). Measures from the CMS safety, patient survey and readmission files.</p>
    </div>
  )
}
