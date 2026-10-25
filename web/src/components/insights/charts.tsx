/**
 * National Insights charts. Each takes slices of national.json and draws through the shared
 * Chart wrapper. Colors come from tokens; red (critical) only marks the penalized side of the cutoff.
 */
import type { EChartsOption } from 'echarts'
import { Chart } from '../charts/Chart'
import { baseOption, useThemeVersion } from '../charts/theme'
import { CATEGORY_LABEL, HAC_LABELS, fmt, token } from '../../lib/format'
import type { National } from '../../lib/types'

const solidGrid = () => ({ lineStyle: { color: token('border'), type: 'solid' as const } })

function axes(base: EChartsOption, x: object, y: object): EChartsOption {
  return {
    ...base,
    xAxis: { ...(base.xAxis as object), ...x },
    yAxis: { ...(base.yAxis as object), splitLine: solidGrid(), ...y },
  } as EChartsOption
}

export function HacHistogram({ histogram, cutoff }: { histogram: National['hac_histogram']; cutoff: number }) {
  useThemeVersion()
  const { bins, counts } = histogram
  const lo = bins[0], hi = bins[bins.length - 1]
  const critical = token('critical'), neutral = token('primary', 0.55), surface = token('surface')
  const data = counts.map((c, i) => [bins[i], bins[i + 1], c])
  const base = baseOption()
  const option = axes(base, {
    type: 'value', min: lo, max: hi, name: 'Total HAC Score (higher = worse)', nameLocation: 'middle', nameGap: 28,
    splitLine: { show: false },
  }, { type: 'value', name: 'Hospitals', nameTextStyle: { color: token('muted') } })
  option.tooltip = {
    ...(base.tooltip as object),
    trigger: 'item',
    formatter: (p: unknown) => {
      const [a, b, c] = (p as { value: number[] }).value
      return `${fmt(a, 2)} to ${fmt(b, 2)}<br/><b>${c}</b> hospitals`
    },
  }
  option.grid = { left: 48, right: 24, top: 36, bottom: 40, containLabel: true }
  option.series = [
    {
      type: 'custom',
      name: 'Hospitals',
      encode: { x: [0, 1], y: 2 },
      data,
      renderItem: (_params: unknown, api: { value: (i: number) => number; coord: (v: number[]) => number[] }) => {
        const start = api.coord([api.value(0), api.value(2)])
        const end = api.coord([api.value(1), 0])
        const width = Math.max(end[0] - start[0] - 2, 1)
        const penal = api.value(0) >= cutoff
        return {
          type: 'rect',
          shape: { x: start[0] + 1, y: start[1], width, height: end[1] - start[1], r: [3, 3, 0, 0] },
          style: { fill: penal ? critical : neutral, stroke: surface, lineWidth: 0 },
        }
      },
    },
    {
      type: 'line',
      data: [],
      silent: true,
      markArea: { silent: true, itemStyle: { color: token('critical', 0.07) }, data: [[{ xAxis: cutoff }, { xAxis: hi }]] },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: critical, width: 2, type: 'solid' },
        label: { formatter: `Cutoff ${fmt(cutoff, 4)}`, color: critical, fontWeight: 600, position: 'end', distance: 4 },
        data: [{ xAxis: cutoff }],
      },
    },
  ] as EChartsOption['series']
  return <Chart option={option} height={320} ariaLabel={`Histogram of Total HAC Scores with the penalty cutoff at ${fmt(cutoff, 4)}`} />
}

export function NursingShareChart({ share }: { share: National['nursing_share'] }) {
  useThemeVersion()
  const order = ['nursing', 'shared', 'other'] as const
  const rows = order.map((c) => share.find((s) => s.category === c)).filter((s): s is National['nursing_share'][number] => !!s)
  const colors = { nursing: token('cat-nursing'), shared: token('cat-shared'), other: token('cat-other') }
  const base = baseOption()
  const option = axes(base, { type: 'value', axisLabel: { color: token('muted'), formatter: (v: number) => `${Math.round(v * 100)}%` }, splitLine: solidGrid() },
    { type: 'category', inverse: true, data: rows.map((r) => CATEGORY_LABEL[r.category]), splitLine: { show: false } })
  option.grid = { left: 8, right: 56, top: 8, bottom: 24, containLabel: true }
  option.tooltip = { ...(base.tooltip as object), trigger: 'item', formatter: (p: unknown) => {
    const i = (p as { dataIndex: number }).dataIndex
    return `${CATEGORY_LABEL[rows[i].category]}<br/><b>${fmt(rows[i].share * 100, 1)}%</b> of weighted points (${fmt(rows[i].points, 1)})`
  } }
  option.series = [{
    type: 'bar', barWidth: 22,
    data: rows.map((r) => ({ value: r.share, itemStyle: { color: colors[r.category], borderRadius: [0, 4, 4, 0] } })),
    label: { show: true, position: 'right', color: token('ink'), formatter: (p: { value: number }) => `${fmt(p.value * 100, 1)}%` },
  }] as EChartsOption['series']
  return <Chart option={option} height={150} ariaLabel="Share of weighted HAC points by nursing category" />
}

export function TippingChart({ counts }: { counts: National['tipping_counts'] }) {
  useThemeVersion()
  const rows = [...counts].sort((a, b) => b.count - a.count)
  const base = baseOption()
  const option = axes(base, { type: 'value', splitLine: solidGrid(), minInterval: 1 },
    { type: 'category', inverse: true, data: rows.map((r) => HAC_LABELS[r.measure]), splitLine: { show: false } })
  option.grid = { left: 8, right: 48, top: 8, bottom: 24, containLabel: true }
  option.tooltip = { ...(base.tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' } }
  option.series = [{
    type: 'bar', name: 'Penalized hospitals', barWidth: 18,
    itemStyle: { color: token('primary'), borderRadius: [0, 4, 4, 0] },
    label: { show: true, position: 'right', color: token('ink') },
    data: rows.map((r) => r.count),
  }] as EChartsOption['series']
  return <Chart option={option} height={Math.max(160, rows.length * 34 + 40)} ariaLabel="Count of hospitals by tipping measure" />
}

export function NurseCommScatter({ points, cutoff }: { points: National['scatter_nurse_comm_vs_hac']; cutoff: number }) {
  useThemeVersion()
  const above = points.filter((p) => p.y > cutoff).map((p) => [p.x, p.y, p.ccn])
  const below = points.filter((p) => p.y <= cutoff).map((p) => [p.x, p.y, p.ccn])
  const base = baseOption()
  const option = axes(base,
    { type: 'value', scale: true, name: 'Nurse communication top-box (%)', nameLocation: 'middle', nameGap: 28, splitLine: solidGrid() },
    { type: 'value', scale: true, name: 'Total HAC Score', nameTextStyle: { color: token('muted') } })
  option.legend = { top: 0, right: 0, textStyle: { color: token('muted') }, itemWidth: 10, itemHeight: 10 }
  option.grid = { left: 48, right: 16, top: 36, bottom: 40, containLabel: true }
  option.tooltip = { ...(base.tooltip as object), trigger: 'item', formatter: (p: unknown) => {
    const v = (p as { value: [number, number, string] }).value
    return `CCN ${v[2]}<br/>Nurse comm top-box: <b>${fmt(v[0], 0)}%</b><br/>Total HAC Score: <b>${fmt(v[1], 4)}</b>`
  } }
  const ring = { borderColor: token('surface'), borderWidth: 1 }
  option.series = [
    { type: 'scatter', name: 'At or below cutoff', symbolSize: 6, data: below, itemStyle: { color: token('primary', 0.55), ...ring }, large: false },
    {
      type: 'scatter', name: 'Above cutoff', symbolSize: 6, data: above, itemStyle: { color: token('critical', 0.7), ...ring },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: token('critical'), width: 1.5, type: 'dashed' },
        label: { formatter: 'Cutoff', color: token('critical'), position: 'insideEndTop' }, data: [{ yAxis: cutoff }] },
    },
  ] as EChartsOption['series']
  return <Chart option={option} height={360} ariaLabel="Scatter plot of nurse communication top-box versus Total HAC Score" />
}

export function PeerPenaltyChart({ rows }: { rows: National['by_peer'] }) {
  useThemeVersion()
  const top = [...rows].filter((r) => r.n >= 15).sort((a, b) => b.pct - a.pct).slice(0, 12)
  const base = baseOption()
  const option = axes(base, { type: 'value', max: 100, axisLabel: { color: token('muted'), formatter: '{value}%' }, splitLine: solidGrid() },
    { type: 'category', inverse: true, data: top.map((r) => r.label), axisLabel: { color: token('muted'), width: 300, overflow: 'truncate' }, splitLine: { show: false } })
  option.grid = { left: 8, right: 48, top: 8, bottom: 24, containLabel: true }
  option.tooltip = { ...(base.tooltip as object), trigger: 'item', formatter: (p: unknown) => {
    const r = top[(p as { dataIndex: number }).dataIndex]
    return `${r.label}<br/><b>${fmt(r.pct, 1)}%</b> penalized (${r.penalized} of ${r.n})`
  } }
  option.series = [{
    type: 'bar', barWidth: 14, itemStyle: { color: token('primary'), borderRadius: [0, 4, 4, 0] },
    label: { show: true, position: 'right', color: token('ink'), formatter: (p: { value: number }) => `${fmt(p.value, 0)}%` },
    data: top.map((r) => r.pct),
  }] as EChartsOption['series']
  return <Chart option={option} height={Math.max(180, top.length * 28 + 40)} ariaLabel="Penalty rate by peer group, top groups" />
}
