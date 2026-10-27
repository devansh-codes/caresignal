import type { EChartsOption } from 'echarts'
import { CategoryBadge } from '../ui'
import { Chart } from '../charts/Chart'
import { baseOption } from '../charts/theme'
import { CATEGORY_LABEL, HAC_TECH_LABELS, fmt, fmtPeriod, fmtSigned, token } from '../../lib/format'
import type { Category, HacMeasureKey } from '../../lib/types'
import type { HacViewModel } from './viewModel'
import { Accordion, Source, ViewToggle } from './shared'
import { CAT_TOKEN, lower, type HacView } from './helpers'

/** Short plain axis labels that fit under each bar. */
const SHORT: Record<HacMeasureKey, string> = {
  psi90: 'Safety events',
  clabsi: 'Central line',
  cauti: 'Catheter',
  ssi: 'Surgical site',
  cdi: 'C. diff',
  mrsa: 'MRSA',
}

/** Each measure's share of the safety score, stacked from zero to the total. */
export default function HacWaterfall({ vm, onView, hasTrajectory }: { vm: HacViewModel; onView: (v: HacView) => void; hasTrajectory: boolean }) {
  const steps = vm.measures.filter((m) => m.weight > 0 && m.contribution != null)
  const missing = vm.measures.filter((m) => !(m.weight > 0 && m.contribution != null))
  let cum = 0
  const rows = steps.map((m) => {
    const start = cum
    cum += m.contribution as number
    return { name: SHORT[m.key], label: m.label, start, end: cum, value: m.contribution as number, cat: m.category }
  })
  const total = vm.total ?? cum
  const above = vm.gap != null && vm.gap > 0
  const data = [...rows.map((r, i) => [i, r.start, r.end, r.value, r.cat]), [rows.length, 0, total, total, 'total']]
  const ext = [0, vm.cutoff, total, ...rows.flatMap((r) => [r.start, r.end])]
  const pad = (Math.max(...ext) - Math.min(...ext)) * 0.15 || 0.1
  const yMin = Math.floor((Math.min(...ext) - pad) * 10) / 10
  const yMax = Math.ceil((Math.max(...ext) + pad) * 10) / 10
  const cats = [...rows.map((r) => r.name), 'Safety score']
  const colors: Record<string, string> = {
    nursing: token(CAT_TOKEN.nursing),
    shared: token(CAT_TOKEN.shared),
    other: token(CAT_TOKEN.other),
    total: above ? token('critical') : '#112659',
  }
  const b = baseOption()
  const option: EChartsOption = {
    ...b,
    grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
    xAxis: { ...(b.xAxis as object), type: 'category', data: cats, axisTick: { show: false }, axisLabel: { color: token('ink'), fontWeight: 600, interval: 0, fontSize: 12 } },
    yAxis: {
      ...(b.yAxis as object), type: 'value', min: yMin, max: yMax,
      name: '↑ Adds to score     ↓ Lowers score', nameTextStyle: { color: token('muted'), fontSize: 12, align: 'left' },
      splitLine: { lineStyle: { color: token('border'), type: 'solid' } },
    },
    tooltip: {
      ...(b.tooltip as object),
      trigger: 'item',
      formatter: (p: unknown) => {
        const { dataIndex } = p as { dataIndex: number }
        if (dataIndex === rows.length) return `<b>Safety score</b><br/>${fmt(total, 2)} (penalty line ${fmt(vm.cutoff, 2)})`
        const r = rows[dataIndex]
        return `<b>${r.label}</b><br/>${CATEGORY_LABEL[r.cat]}<br/>${r.value >= 0 ? 'Adds' : 'Lowers the score by'} <b>${fmt(Math.abs(r.value), 2)}</b>${r.value >= 0 ? ' to the score' : ''}`
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
          const w = Math.min(44, band * 0.6)
          const top = Math.min(a[1], c[1]), h = Math.max(1, Math.abs(a[1] - c[1]))
          const up = e >= s
          const children: unknown[] = [{ type: 'rect', shape: { x: a[0] - w / 2, y: top, width: w, height: h }, style: { fill: colors[kind] } }]
          if (i < data.length - 1) {
            const next = api.coord([i + 1, e])
            children.push({ type: 'line', shape: { x1: a[0] + w / 2, y1: c[1], x2: next[0] - w / 2, y2: c[1] }, style: { stroke: token('muted'), lineWidth: 1, lineDash: [2, 2] } })
          }
          const v = data[i][3] as number
          children.push({
            type: 'text',
            style: {
              text: i === data.length - 1 ? fmt(v, 2) : `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}`,
              x: a[0],
              y: up ? top - 4 : top + h + 4,
              align: 'center',
              verticalAlign: up ? 'bottom' : 'top',
              fill: token('ink'),
              fontSize: 12,
              fontWeight: i === data.length - 1 ? 700 : 600,
            },
          })
          return { type: 'group', children } as never
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            { yAxis: vm.cutoff, lineStyle: { color: token('critical'), width: 2, type: 'solid' }, label: { show: false } },
            { yAxis: 0, lineStyle: { color: token('muted'), width: 1, type: 'solid' }, label: { show: false } },
          ],
        },
      },
    ],
  }

  const biggest = [...rows].sort((a, b) => b.value - a.value)[0]

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
          <span className="font-semibold text-ink">How to read this: </span>
          Medicare looks at six safety measures and gives each one equal weight. Bars going up add to the score, which is worse. Bars going down lower it, which is better. The last bar is the total.
          {biggest && biggest.value > 0 && <> The biggest single driver here is <strong className="text-ink">{lower(biggest.label)}</strong>.</>}
        </p>
        <ViewToggle view={vm.view} onChange={onView} hasTrajectory={hasTrajectory} />
      </div>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink" aria-label="Color key">
        {(['nursing', 'shared', 'other'] as Category[]).map((c) => (
          <li key={c} className="inline-flex items-center gap-2">
            <span aria-hidden className="h-3 w-3" style={{ background: colors[c] }} />
            {CATEGORY_LABEL[c]}
          </li>
        ))}
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="h-3 w-3" style={{ background: colors.total }} />
          Total safety score
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5" style={{ background: token('critical') }} />
          Penalty line ({fmt(vm.cutoff, 2)})
        </li>
      </ul>
      {rows.length ? (
        <Chart option={option} height={320} ariaLabel={`Chart of what drives the safety score: ${rows.map((r) => `${r.label} ${r.value >= 0 ? 'adds' : 'lowers'} ${fmt(Math.abs(r.value), 2)}`).join(', ')}. Total ${fmt(total, 2)}, penalty line ${fmt(vm.cutoff, 2)}.`} />
      ) : (
        <p className="py-6 text-center text-sm text-muted">No measure results to show for this view.</p>
      )}
      {missing.length > 0 && (
        <p className="mt-2 text-sm text-muted">No result for {missing.map((m) => lower(m.label)).join(', ')}. The score is split equally across the measures this hospital does have.</p>
      )}
      <div className="mt-5">
        <Accordion title="Show the numbers behind this chart">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Safety measure values and how much each adds to the score</caption>
              <thead>
                <tr className="border-b-2 border-[#112659] text-left text-xs font-bold uppercase tracking-wider text-ink">
                  <th scope="col" className="py-2 pr-3">Measure</th>
                  <th scope="col" className="py-2 pr-3">Who owns it</th>
                  <th scope="col" className="py-2 pr-3 text-right">Rate</th>
                  <th scope="col" className="py-2 pr-3 text-right">Points vs average</th>
                  <th scope="col" className="py-2 text-right">Adds to score</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {vm.measures.map((m) => (
                  <tr key={m.key} className="border-b border-[#C9D2E3] last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink">
                      {m.label}
                      <span className="block text-xs font-normal text-muted">{HAC_TECH_LABELS[m.key]}</span>
                    </th>
                    <td className="py-2 pr-3"><CategoryBadge category={m.category} /></td>
                    <td className="py-2 pr-3 text-right">{fmt(m.value, m.key === 'psi90' ? 4 : 3)}</td>
                    <td className="py-2 pr-3 text-right">{fmtSigned(m.z, 2)}</td>
                    <td className="py-2 text-right font-semibold">{m.weight ? fmtSigned(m.contribution, 3) : 'Not counted'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            <strong className="text-ink">Rate</strong> is the infection rate compared with what Medicare expected (1.0 means as expected), or the combined safety event rate.{' '}
            <strong className="text-ink">Points vs average</strong> shows how far the hospital is from the national average, in standard steps (CMS calls this a z score).
            Each measure counts equally, so its points are divided by the number of measures.
          </p>
        </Accordion>
      </div>
      <Source>
        {vm.view === 'program' ? 'CMS Hospital Acquired Condition Reduction Program, FY2026 official scores' : 'CMS Healthcare Associated Infections file and patient safety file, scored with the FY2026 rules'}
        {'. '}
        {vm.periodText.map((p) => `${p.label}: ${fmtPeriod(p.period)}`).join('. ')}
      </Source>
    </div>
  )
}
