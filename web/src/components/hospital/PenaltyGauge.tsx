import type { EChartsOption } from 'echarts'
import { Card, StateView } from '../ui'
import { Chart } from '../charts/Chart'
import { baseOption } from '../charts/theme'
import { fmt, fmtOrdinal, token } from '../../lib/format'
import type { National } from '../../lib/types'
import type { HacViewModel } from './viewModel'
import { sourceLine } from './helpers'

/** Position of this hospital's Total HAC Score on the national distribution, with the penalty cutoff. */
export default function PenaltyGauge({ vm, national, percentile }: { vm: HacViewModel; national: National | null; percentile: number | null }) {
  const hist = national?.hac_histogram
  const total = vm.total
  const gap = vm.gap
  const exempt = vm.status === 'exempt'
  const position = gap == null ? '' : gap > 0 ? `above the cutoff by ${fmt(gap, 4)}` : `below the cutoff by ${fmt(-gap, 4)}`
  const headline =
    total == null || gap == null
      ? 'No total score for this view'
      : exempt
        ? `Exempt (Maryland): scored ${position}, no payment reduction`
        : gap > 0
        ? `Above cutoff by ${fmt(gap, 4)}`
        : vm.status === 'near'
          ? `Within reach of the cutoff — clear by ${fmt(-gap, 4)}`
          : `Clear of the cutoff by ${fmt(-gap, 4)}`
  const tone = gap == null || exempt ? 'text-muted' : gap > 0 ? 'text-critical' : vm.status === 'near' ? 'text-warning' : 'text-ok'

  let option: EChartsOption | null = null
  if (hist && hist.counts.length) {
    const rects = hist.counts.map((c, i) => [hist.bins[i], hist.bins[i + 1], c])
    const crit = token('critical', 0.55)
    const neutral = token('cat-other', 0.45)
    const surface = token('surface')
    const b = baseOption()
    option = {
      ...b,
      grid: { left: 8, right: 16, top: 34, bottom: 28, containLabel: true },
      xAxis: { ...(b.xAxis as object), type: 'value', min: hist.bins[0], max: hist.bins[hist.bins.length - 1], name: 'Total HAC Score (higher = worse)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: token('muted'), fontSize: 11 }, splitLine: { show: false } },
      yAxis: { ...(b.yAxis as object), type: 'value', name: 'Hospitals', nameTextStyle: { color: token('muted'), fontSize: 11 }, splitLine: { lineStyle: { color: token('border'), type: 'solid' } } },
      tooltip: { ...(b.tooltip as object), trigger: 'item', formatter: (p: unknown) => {
        const d = (p as { data: number[] }).data
        return d ? `${fmt(d[0], 2)} to ${fmt(d[1], 2)}<br/><b>${d[2]}</b> hospitals` : ''
      } },
      series: [
        {
          type: 'custom',
          name: 'National distribution',
          data: rects,
          renderItem: (_params, api) => {
            const lo = api.value(0) as number, hi = api.value(1) as number, c = api.value(2) as number
            const p0 = api.coord([lo, 0]), p1 = api.coord([hi, c])
            const above = (lo + hi) / 2 > vm.cutoff
            return {
              type: 'rect',
              shape: { x: p0[0] + 1, y: p1[1], width: Math.max(1, p1[0] - p0[0] - 2), height: p0[1] - p1[1], r: [3, 3, 0, 0] },
              style: { fill: above ? crit : neutral },
            }
          },
          encode: { x: [0, 1], y: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              { xAxis: vm.cutoff, lineStyle: { color: token('critical'), width: 2, type: 'solid' }, label: { formatter: `Penalty cutoff ${fmt(vm.cutoff, 4)}`, color: token('ink'), fontSize: 11, position: 'end' } },
              ...(total != null
                ? [{ xAxis: Math.min(Math.max(total, hist.bins[0]), hist.bins[hist.bins.length - 1]), lineStyle: { color: token('ink'), width: 2, type: 'solid' as const }, label: { formatter: `This hospital ${fmt(total, 3)}`, color: token('ink'), fontSize: 11, fontWeight: 600, position: 'insideEndTop' as const, backgroundColor: surface, padding: [2, 4] } }]
                : []),
            ],
          },
        },
      ],
    } as EChartsOption
  }

  return (
    <Card
      title="Penalty proximity"
      subtitle={vm.label}
      action={<span className={`text-right text-sm font-semibold ${tone}`}>{headline}</span>}
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted">Total </span>
          <span className="tabular text-lg font-semibold">{fmt(total, 4)}</span>
        </span>
        <span>
          <span className="text-muted">Cutoff (75th pct.) </span>
          <span className="tabular font-semibold">{fmt(vm.cutoff, 4)}</span>
        </span>
        {vm.view === 'program' && percentile != null && (
          <span>
            <span className="text-muted">National position </span>
            <span className="tabular font-semibold">{fmtOrdinal(percentile)} percentile</span>
            <span className="text-muted"> (higher = worse)</span>
          </span>
        )}
      </div>
      {option ? (
        <Chart option={option} height={220} ariaLabel={`Histogram of national Total HAC Scores with the penalty cutoff at ${fmt(vm.cutoff, 3)} and this hospital at ${fmt(total, 3)}.`} />
      ) : (
        <StateView kind="loading" />
      )}
      {vm.view === 'trajectory' && (
        <p className="mt-2 text-xs text-muted">Trajectory totals are scored against the FY2026 distribution as a proxy. The real cutoff moves every year. Approximate.</p>
      )}
      <p className="mt-2 text-[11px] text-muted">
        Source: CMS HAC Reduction Program (yq43-i98g), FY2026 national distribution{vm.view === 'trajectory' ? ` · this hospital: ${sourceLine(vm.source, 'HAI', vm.periodText[0]?.period)}` : ''}
      </p>
    </Card>
  )
}
