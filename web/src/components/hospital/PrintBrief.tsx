import { CATEGORY_LABEL, HAC_LABELS, STATUS_LABEL, fmt, fmtDate, fmtPeriod, fmtUsd, titleCase } from '../../lib/format'
import type { Category, Hospital, Manifest } from '../../lib/types'
import { noun, plain, plainReason, statusSentence } from './helpers'

const CAT_FILL: Record<Category, string> = { nursing: '#0B6E8A', shared: '#6C5CD2', other: '#808C9E' }

/**
 * One page printable summary. Hidden on screen and shown only in print.
 * Static SVG (no ECharts) so it renders reliably in the print layout.
 */
export default function PrintBrief({ h, manifest }: { h: Hospital; manifest: Manifest | null }) {
  const hac = h.hac
  const nurse = h.hcahps?.items.find((i) => i.id === 'H_COMP_1_A_P')
  const measures = hac?.measures.filter((m) => m.weight > 0 && m.contribution != null) ?? []
  const maxAbs = Math.max(0.05, ...measures.map((m) => Math.abs(m.contribution as number)))
  const ptp = (hac?.patients_to_prevent ?? []).filter((p) => p.measure !== 'psi90')
  const above = hac ? hac.gap > 0 : false
  const cush = (hac?.cushion_events ?? []).filter((p) => p.feasible && p.events != null)
  const updated = manifest?.sources.map((s) => s.modified).filter(Boolean).sort().pop()

  return (
    <article className="hidden text-[11px] leading-snug text-black print:block" aria-hidden>
      <header className="border-b-4 border-[#112659] pb-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#2F4F9E]">CareSignal · Hospital summary</div>
        <h1 className="text-2xl font-bold text-[#112659]">{titleCase(plain(h.name))}</h1>
        <div>
          {titleCase(h.city)}, {h.state} · Medicare ID {h.ccn} · {plain(h.type)}
          {h.peer ? ` · Compared with ${h.peer.n} similar hospitals` : ''}
        </div>
      </header>

      <p className="mt-2 text-[13px] font-semibold text-[#112659]">{STATUS_LABEL[hac?.status ?? 'no_score']}</p>
      <p className="text-[12px]">{statusSentence(h)}</p>

      <section className="mt-3 grid grid-cols-4 gap-2">
        {[
          ['Safety score', hac ? fmt(hac.total, 2) : 'N/A', hac ? `Penalty line ${fmt(hac.cutoff, 2)}` : 'No safety score'],
          ['Medicare penalty', hac?.status === 'exempt' ? 'Exempt (Maryland)' : hac?.payment_reduction == null ? 'N/A' : hac.payment_reduction ? '1% of payments' : 'None', hac ? `FY${hac.fiscal_year} official result` : ''],
          ['Money at risk', fmtUsd(hac?.exposure_usd), 'Estimate: 1% of Medicare inpatient payments'],
          ['Nurse communication', nurse?.value != null ? `${fmt(nurse.value, 0)}%` : 'N/A', nurse?.percentile_national != null ? `Better than ${Math.round(nurse.percentile_national)}% of hospitals` : ''],
        ].map(([l, v, c]) => (
          <div key={l} className="border border-[#C9D2E3] p-2">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#2F4F9E]">{l}</div>
            <div className="text-lg font-light text-[#112659]">{v}</div>
            <div className="text-[9px]">{c}</div>
          </div>
        ))}
      </section>

      {hac && (
        <section className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="mb-1 text-xs font-bold text-[#112659]">What is driving the score</h2>
            <p className="mb-1 text-[9px]">Bars to the right add to the score (worse). Bars to the left lower it (better).</p>
            <svg viewBox={`0 0 300 ${measures.length * 18 + 4}`} width="100%">
              <line x1="170" x2="170" y1="0" y2={measures.length * 18 + 4} stroke="#000" strokeWidth="0.6" />
              {measures.map((m, i) => {
                const w = (Math.abs(m.contribution as number) / maxAbs) * 80
                const pos = (m.contribution as number) >= 0
                const v = m.contribution as number
                return (
                  <g key={m.key} transform={`translate(0 ${i * 18 + 2})`}>
                    <text x="0" y="11" fontSize="9">{HAC_LABELS[m.key]}</text>
                    <rect x={pos ? 170 : 170 - w} y="2" width={Math.max(1, w)} height="12" fill={CAT_FILL[m.category]} />
                    <text x={pos ? 170 + w + 3 : 170 - w - 3} y="11" fontSize="9" textAnchor={pos ? 'start' : 'end'}>{`${v >= 0 ? '+' : '−'}${fmt(Math.abs(v), 2)}`}</text>
                  </g>
                )
              })}
            </svg>
            <div className="mt-1 flex gap-3 text-[9px]">
              {(Object.keys(CAT_FILL) as Category[]).map((c) => (
                <span key={c} className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2" style={{ background: CAT_FILL[c] }} />{CATEGORY_LABEL[c]}</span>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-1 text-xs font-bold text-[#112659]">{above ? 'Infections to prevent to get below the line' : 'Room before crossing the line'}</h2>
            <table className="w-full">
              <tbody>
                {(above ? ptp : cush).map((p) => (
                  <tr key={p.measure} className={`border-b border-black/20 ${p.measure === hac.tipping_measure && above ? 'font-bold' : ''}`}>
                    <td className="py-0.5">{HAC_LABELS[p.measure]}</td>
                    <td className="py-0.5 text-right">
                      {p.feasible && p.events != null ? `${p.events} ${above ? 'fewer' : 'more'} ${noun(p.measure, p.events)}` : plainReason(p.reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[9px]">Estimates. They assume other hospitals and the penalty line stay the same, but the line moves every year.</p>
          </div>
        </section>
      )}

      {h.readmissions && h.readmissions.rows.length > 0 && (
        <section className="mt-3">
          <h2 className="mb-1 text-xs font-bold text-[#112659]">Patients coming back within 30 days (1.0 means as expected, above 1.0 means more than expected)</h2>
          <div className="flex flex-wrap gap-x-4">
            {h.readmissions.rows.map((r) => (
              <span key={r.condition}>{plain(r.label).replace('/', ' or ')}: <b>{fmt(r.err, 2)}</b>{r.err != null && r.err > 1 ? ' ▲' : ''}</span>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-4 border-t border-black/40 pt-2 text-[8.5px]">
        <b>Sources (public CMS data):</b>{' '}
        {hac && `Hospital Acquired Condition Reduction Program, FY${hac.fiscal_year} (safety events ${fmtPeriod(hac.period.psi90)}; infections ${fmtPeriod(hac.period.hai)}). `}
        {h.hai && `Healthcare Associated Infections (${fmtPeriod(h.hai.period)}). `}
        {h.hcahps && `Patient survey (${fmtPeriod(h.hcahps.period)}). `}
        {h.readmissions && `Hospital Readmissions Reduction Program (${fmtPeriod(h.readmissions.period)}). `}
        {updated && `CMS data as of ${fmtDate(updated)}. `}
        Infection counts and money at risk are CareSignal estimates. Printed {new Date().toLocaleDateString('en-US')}.
      </footer>
    </article>
  )
}
