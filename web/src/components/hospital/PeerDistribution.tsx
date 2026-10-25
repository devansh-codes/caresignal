import { useState } from 'react'
import type { EChartsOption } from 'echarts'
import { Card, SourceNote, StateView } from '../ui'
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
    label: 'HAC measures',
    metrics: [
      { id: 'hac_total', label: 'Total HAC Score', higherBetter: false, digits: 3 },
      { id: 'cauti_value', label: 'CAUTI SIR', higherBetter: false, digits: 3 },
      { id: 'clabsi_value', label: 'CLABSI SIR', higherBetter: false, digits: 3 },
      { id: 'cdi_value', label: 'CDI SIR', higherBetter: false, digits: 3 },
      { id: 'mrsa_value', label: 'MRSA SIR', higherBetter: false, digits: 3 },
      { id: 'ssi_value', label: 'SSI SIR', higherBetter: false, digits: 3 },
      { id: 'psi90_value', label: 'PSI 90 composite', higherBetter: false, digits: 3 },
    ],
  },
  {
    id: 'experience',
    label: 'Experience & readmissions',
    metrics: [
      { id: 'nurse_comm', label: 'Nurse communication (top-box %)', higherBetter: true, digits: 0 },
      { id: 'discharge_info', label: 'Discharge information (yes %)', higherBetter: true, digits: 0 },
      { id: 'hcahps_star', label: 'HCAHPS summary star', higherBetter: true, digits: 0 },
      { id: 'err_hf', label: 'Heart failure ERR', higherBetter: false, digits: 3 },
      { id: 'err_pn', label: 'Pneumonia ERR', higherBetter: false, digits: 3 },
      { id: 'err_copd', label: 'COPD ERR', higherBetter: false, digits: 3 },
      { id: 'err_ami', label: 'AMI ERR', higherBetter: false, digits: 3 },
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
      return `${(p as { seriesName: string }).seriesName === 'This hospital' ? '<b>This hospital</b>' : `Peer CCN ${d[2]}`}<br/>${m.label}: ${fmt(d[0] as number, m.digits)}`
    } },
    series: [
      {
        type: 'scatter',
        name: 'Peers',
        data: pts,
        symbolSize: 6,
        itemStyle: { color: token('cat-other', 0.45) },
        markLine: med == null ? undefined : { silent: true, symbol: 'none', data: [{ xAxis: med }], lineStyle: { color: token('ink'), width: 1.5, type: 'solid' }, label: { formatter: `Median ${fmt(med, m.digits)}`, position: 'end', color: token('muted'), fontSize: 10 } },
      },
      ...(self == null
        ? []
        : [{ type: 'scatter' as const, name: 'This hospital', data: [[self, 0, 'self']], symbolSize: 14, z: 5, itemStyle: { color: token('primary'), borderColor: token('surface'), borderWidth: 2 } }]),
    ],
  }
  return (
    <div className="border-b border-border/60 py-2 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink">{m.label}</span>
        <span className="tabular text-xs text-muted">
          {self == null ? 'Not reported for this hospital' : <>This hospital <strong className="text-ink">{fmt(self, m.digits)}</strong> · {pct == null ? 'no peer comparison' : `better than ${Math.round(pct)}% of peers`} ({m.higherBetter ? 'higher' : 'lower'} is better)</>}
        </span>
      </div>
      {all.length ? <Chart option={option} height={72} ariaLabel={`${m.label}: this hospital ${fmt(self, m.digits)} versus ${all.length} peers, median ${fmt(med, m.digits)}.`} /> : <p className="py-2 text-xs text-muted">No peer values.</p>}
    </div>
  )
}

export default function PeerDistribution({ h, peers }: { h: Hospital; peers: AsyncState<PeerFile> | null }) {
  const [group, setGroup] = useState(GROUPS[0].id)
  const g = GROUPS.find((x) => x.id === group)!
  return (
    <Card
      title="Peer benchmark"
      subtitle={h.peer ? `Compared with ${h.peer.n} hospitals in “${h.peer.label}”. Peers are anonymous; this view never names competitors.` : 'No peer group assigned.'}
      action={
        <div role="tablist" aria-label="Peer metric group" className="no-print inline-flex rounded-md bg-surface-2 p-0.5">
          {GROUPS.map((x) => (
            <button key={x.id} role="tab" aria-selected={group === x.id} type="button" onClick={() => setGroup(x.id)}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${group === x.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      <ul className="mb-1 flex gap-4 text-xs text-muted" aria-label="Legend">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-primary ring-2 ring-surface" />This hospital</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full bg-other/50" />Peer hospital</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-0.5 bg-ink" />Peer median</li>
      </ul>
      {!h.peer || !peers ? (
        <StateView kind="empty" message="This hospital has no cost-report match, so no peer group can be formed." />
      ) : peers.status === 'loading' ? (
        <StateView kind="loading" />
      ) : peers.status === 'error' ? (
        <StateView kind="error" message={`Peer data could not be loaded (${peers.error}).`} />
      ) : (
        <div>{g.metrics.map((m) => <Strip key={m.id} peer={peers.data} idx={peers.data.hospitals.indexOf(h.ccn)} m={m} />)}</div>
      )}
      <SourceNote>Peer rules: bed size × teaching intensity × urban/rural × Census region (CMS Hospital Provider Cost Report), with a minimum of 15 HAC-scored hospitals · measures from yq43-i98g, dgck-syfz, 9n3s-kdb3</SourceNote>
    </Card>
  )
}
