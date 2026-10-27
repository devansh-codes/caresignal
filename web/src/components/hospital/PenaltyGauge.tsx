import type { EChartsOption } from 'echarts'
import { StateView } from '../ui'
import { Chart } from '../charts/Chart'
import { baseOption } from '../charts/theme'
import { fmt, token } from '../../lib/format'
import type { National } from '../../lib/types'
import type { HacViewModel } from './viewModel'
import { sourceLine } from './helpers'
import { Source } from './shared'

/** Where this hospital's safety score falls among all scored hospitals, with the penalty line. */
export default function PenaltyGauge({ vm, national, percentile }: { vm: HacViewModel; national: National | null; percentile: number | null }) {
  const hist = national?.hac_histogram
  const total = vm.total
  const gap = vm.gap
  const exempt = vm.status === 'exempt'

  let option: EChartsOption | null = null
  if (hist && hist.counts.length) {
    const rects = hist.counts.map((c, i) => [hist.bins[i], hist.bins[i + 1], c])
    const crit = token('critical', 0.6)
    const neutral = '#9FC2D1'
    const b = baseOption()
    option = {
      ...b,
      grid: { left: 8, right: 16, top: 16, bottom: 34, containLabel: true },
      xAxis: { ...(b.xAxis as object), type: 'value', min: hist.bins[0], max: hist.bins[hist.bins.length - 1], name: 'Safety score (higher is worse)', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: token('muted'), fontSize: 12 }, splitLine: { show: false } },
      yAxis: { ...(b.yAxis as object), type: 'value', splitLine: { lineStyle: { color: token('border'), type: 'solid' } } },
      tooltip: { ...(b.tooltip as object), trigger: 'item', formatter: (p: unknown) => {
        const d = (p as { data: number[] }).data
        return d ? `Scores ${fmt(d[0], 2)} to ${fmt(d[1], 2)}<br/><b>${d[2]}</b> hospitals` : ''
      } },
      series: [
        {
          type: 'custom',
          name: 'All scored hospitals',
          data: rects,
          renderItem: (_params, api) => {
            const lo = api.value(0) as number, hi = api.value(1) as number, c = api.value(2) as number
            const p0 = api.coord([lo, 0]), p1 = api.coord([hi, c])
            const above = (lo + hi) / 2 > vm.cutoff
            return {
              type: 'rect',
              shape: { x: p0[0] + 1, y: p1[1], width: Math.max(1, p1[0] - p0[0] - 2), height: p0[1] - p1[1] },
              style: { fill: above ? crit : neutral },
            }
          },
          encode: { x: [0, 1], y: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            data: [
              { xAxis: vm.cutoff, lineStyle: { color: token('critical'), width: 2, type: 'solid' }, label: { show: false } },
              ...(total != null
                ? [{ xAxis: Math.min(Math.max(total, hist.bins[0]), hist.bins[hist.bins.length - 1]), lineStyle: { color: '#112659', width: 3, type: 'solid' as const }, label: { show: false } }]
                : []),
            ],
          },
        },
      ],
    } as EChartsOption
  }

  const where =
    total == null || gap == null
      ? 'There is no score to place on the chart for this view.'
      : `Each bar counts hospitals with a similar score. Red bars are above the penalty line. This hospital${exempt ? ' (exempt, Maryland)' : ''} is the navy line${
          vm.view === 'program' && percentile != null ? `, and it scores worse than about ${Math.round(percentile)}% of hospitals` : ''
        }.`

  return (
    <div>
      <h3 className="text-lg font-bold text-ink">How this hospital compares with every scored hospital</h3>
      <p className="mt-1 text-[15px] text-muted">{where}</p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink" aria-label="Chart key">
        <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 bg-[#9FC2D1]" />Hospitals below the line</li>
        <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3" style={{ background: token('critical', 0.6) }} />Hospitals above the line</li>
        <li className="inline-flex items-center gap-2"><span aria-hidden className="h-0.5 w-5" style={{ background: token('critical') }} />Penalty line ({fmt(vm.cutoff, 2)})</li>
        {total != null && <li className="inline-flex items-center gap-2"><span aria-hidden className="h-4 w-1 bg-[#112659]" /><strong>This hospital ({fmt(total, 2)})</strong></li>}
      </ul>
      <p className="mt-1 text-xs text-muted">Bar height is the number of hospitals with that score.</p>
      <div className="mt-2">
        {option ? (
          <Chart option={option} height={250} ariaLabel={`Chart of safety scores for all hospitals. The penalty line is at ${fmt(vm.cutoff, 2)} and this hospital scores ${fmt(total, 2)}.`} />
        ) : (
          <StateView kind="loading" />
        )}
      </div>
      {vm.view === 'trajectory' && (
        <p className="mt-2 text-sm text-muted">This preview scores the latest data against this year’s rules. The real line moves every year, so treat it as an early warning.</p>
      )}
      <Source>
        CMS Hospital Acquired Condition Reduction Program, FY2026, all scored hospitals
        {vm.view === 'trajectory' ? `. This hospital: ${sourceLine('Healthcare Associated Infections file', vm.periodText[0]?.period)}` : ''}
      </Source>
    </div>
  )
}
