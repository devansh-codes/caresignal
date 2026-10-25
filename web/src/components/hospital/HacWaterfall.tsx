import type { EChartsOption } from 'echarts'
import { Card, CategoryBadge, SourceNote } from '../ui'
import { Chart } from '../charts/Chart'
import { baseOption } from '../charts/theme'
import { CATEGORY_LABEL, fmt, fmtPeriod, fmtSigned, token } from '../../lib/format'
import type { Category } from '../../lib/types'
import type { HacViewModel } from './viewModel'
import { ViewToggle } from './shared'
import { CAT_TOKEN, type HacView } from './helpers'

const SHORT: Record<string, string> = { psi90: 'PSI 90', clabsi: 'CLABSI', cauti: 'CAUTI', ssi: 'SSI', cdi: 'CDI', mrsa: 'MRSA' }

/** Waterfall of weighted z contributions (z × weight), cumulating to the Total HAC Score. */
export default function HacWaterfall({ vm, onView, hasTrajectory }: { vm: HacViewModel; onView: (v: HacView) => void; hasTrajectory: boolean }) {
  const steps = vm.measures.filter((m) => m.weight > 0 && m.contribution != null)
  const missing = vm.measures.filter((m) => !(m.weight > 0 && m.contribution != null))
  let cum = 0
  const rows = steps.map((m) => {
    const start = cum
    cum += m.contribution as number
    return { name: SHORT[m.key], key: m.key, start, end: cum, value: m.contribution as number, cat: m.category, z: m.z, w: m.weight }
  })
  const total = vm.total ?? cum
  const above = vm.gap != null && vm.gap > 0
  const data = [
    ...rows.map((r, i) => [i, r.start, r.end, r.value, r.cat]),
    [rows.length, 0, total, total, 'total'],
  ]
  const ext = [0, vm.cutoff, total, ...rows.flatMap((r) => [r.start, r.end])]
  const pad = (Math.max(...ext) - Math.min(...ext)) * 0.12 || 0.1
  const yMin = Math.floor((Math.min(...ext) - pad) * 10) / 10
  const yMax = Math.ceil((Math.max(...ext) + pad) * 10) / 10
  const cats = [...rows.map((r) => r.name), 'Total']
  const colors: Record<string, string> = {
    nursing: token(CAT_TOKEN.nursing),
    shared: token(CAT_TOKEN.shared),
    other: token(CAT_TOKEN.other),
    total: above ? token('critical') : token('ok'),
  }
  const b = baseOption()
  const option: EChartsOption = {
    ...b,
    grid: { left: 8, right: 24, top: 28, bottom: 8, containLabel: true },
    xAxis: { ...(b.xAxis as object), type: 'category', data: cats, axisTick: { show: false }, axisLabel: { color: token('ink'), fontWeight: 500 } },
    yAxis: { ...(b.yAxis as object), type: 'value', min: yMin, max: yMax, name: 'Weighted z (higher = worse)', nameTextStyle: { color: token('muted'), fontSize: 11 }, splitLine: { lineStyle: { color: token('border'), type: 'solid' } } },
    tooltip: {
      ...(b.tooltip as object),
      trigger: 'item',
      formatter: (p: unknown) => {
        const { dataIndex } = p as { dataIndex: number }
        if (dataIndex === rows.length) return `<b>Total HAC Score</b><br/>${fmt(total, 4)} (cutoff ${fmt(vm.cutoff, 4)})`
        const r = rows[dataIndex]
        return `<b>${r.name}</b> · ${CATEGORY_LABEL[r.cat]}<br/>z ${fmt(r.z, 4)} × weight ${fmt(r.w, 3)}<br/>Contribution <b>${fmtSigned(r.value, 4)}</b>`
      },
    },
    series: [
      {
        type: 'custom',
        data,
        encode: { x: 0, y: [1, 2] },
        renderItem: (params, api) => {
          const i = params.dataIndex
          const s = api.value(1) as number, e = api.value(2) as number
          const kind = data[i][4] as string
          const a = api.coord([i, s]), c = api.coord([i, e])
          const band = (api.size?.([1, 0]) as number[])[0]
          const w = Math.min(36, band * 0.55)
          const top = Math.min(a[1], c[1]), h = Math.max(1, Math.abs(a[1] - c[1]))
          const up = e >= s
          const children: unknown[] = [
            {
              type: 'rect',
              shape: { x: a[0] - w / 2, y: top, width: w, height: h, r: up ? [4, 4, 0, 0] : [0, 0, 4, 4] },
              style: { fill: colors[kind] },
            },
          ]
          if (i < data.length - 1) {
            const next = api.coord([i + 1, e])
            children.push({ type: 'line', shape: { x1: a[0] + w / 2, y1: c[1], x2: next[0] - w / 2, y2: c[1] }, style: { stroke: token('muted'), lineWidth: 1, lineDash: [2, 2] } })
          }
          children.push({
            type: 'text',
            style: {
              text: fmtSigned(data[i][3] as number, 3).replace(/^\+/, i === data.length - 1 ? '' : '+'),
              x: a[0],
              y: up ? top - 4 : top + h + 4,
              align: 'center',
              verticalAlign: up ? 'bottom' : 'top',
              fill: token('ink'),
              fontSize: 11,
              fontWeight: i === data.length - 1 ? 700 : 500,
            },
          })
          return { type: 'group', children } as never
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: vm.cutoff, lineStyle: { color: token('critical'), width: 1.5, type: 'solid' }, label: { formatter: `Cutoff ${fmt(vm.cutoff, 3)}`, color: token('ink'), fontSize: 11, position: 'insideEndTop' } },
            { yAxis: 0, lineStyle: { color: token('muted'), width: 1, type: 'solid' }, label: { show: false } },
          ],
        },
      },
    ],
  }

  return (
    <Card
      title="What drives the score"
      subtitle="Each measure's weighted contribution (z-score × equal weight). Bars above zero push the hospital toward the penalty."
      action={<ViewToggle view={vm.view} onChange={onView} hasTrajectory={hasTrajectory} />}
    >
      <ul className="mb-2 flex flex-wrap gap-3 text-xs text-muted" aria-label="Legend">
        {(['nursing', 'shared', 'other'] as Category[]).map((c) => (
          <li key={c} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[c] }} />
            {CATEGORY_LABEL[c]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: colors.total }} />
          Total ({above ? 'above cutoff' : 'at or below cutoff'})
        </li>
      </ul>
      {rows.length ? (
        <Chart option={option} height={300} ariaLabel={`Waterfall of HAC measure contributions: ${rows.map((r) => `${r.name} ${fmtSigned(r.value, 3)}`).join(', ')}; total ${fmt(total, 3)} against cutoff ${fmt(vm.cutoff, 3)}.`} />
      ) : (
        <p className="py-6 text-center text-sm text-muted">No measure results in this view.</p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">HAC measure values, z-scores, weights and contributions</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-1.5 pr-2 font-medium">Measure</th>
              <th scope="col" className="py-1.5 pr-2 font-medium">Category</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-medium">Value</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-medium">z</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-medium">Weight</th>
              <th scope="col" className="py-1.5 text-right font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {vm.measures.map((m) => (
              <tr key={m.key} className="border-b border-border/60 last:border-0">
                <th scope="row" className="py-1.5 pr-2 text-left font-medium">{m.label}</th>
                <td className="py-1.5 pr-2"><CategoryBadge category={m.category} /></td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.value, m.key === 'psi90' ? 4 : 3)}</td>
                <td className="py-1.5 pr-2 text-right">{fmt(m.z, 4)}</td>
                <td className="py-1.5 pr-2 text-right">{m.weight ? fmt(m.weight, 3) : '—'}</td>
                <td className={`py-1.5 text-right font-medium ${m.contribution != null && m.contribution > 0 ? 'text-ink' : 'text-muted'}`}>{fmtSigned(m.contribution, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missing.length > 0 && (
        <p className="mt-2 text-xs text-muted">No result (zero weight): {missing.map((m) => SHORT[m.key]).join(', ')}. Weights are split equally across the measures this hospital has.</p>
      )}
      <SourceNote>
        {vm.view === 'program' ? 'CMS HAC Reduction Program (yq43-i98g), official Winsorized z-scores' : 'CMS Healthcare Associated Infections (77hc-ibv8) + PSI-90 six-digit file (muwa-iene), scored with FY2026 parameters'}
        {' · '}
        {vm.periodText.map((p) => `${p.label} ${fmtPeriod(p.period)}`).join(' · ')}
      </SourceNote>
    </Card>
  )
}
