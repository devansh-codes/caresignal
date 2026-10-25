import { CATEGORY_LABEL, HAC_EVENT_NOUN, HAC_LABELS, STATUS_LABEL, fmt, fmtOrdinal, fmtPeriod, fmtSigned, fmtUsd } from '../../lib/format'
import type { Category, Hospital, Manifest } from '../../lib/types'

const CAT_FILL: Record<Category, string> = { nursing: '#0B6E8A', shared: '#6C5CD2', other: '#808C9E' }

/**
 * One-page printable brief. Hidden on screen and shown only in print.
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

  const used = new Set(['xubh-q36u', hac?.source, h.hai?.source, h.hcahps?.source, h.readmissions?.source].filter(Boolean) as string[])
  const srcs = manifest?.sources.filter((s) => used.has(s.id)) ?? []

  return (
    <article className="hidden text-[11px] leading-snug text-black print:block" aria-hidden>
      <header className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider">CareSignal · Hospital quality brief</div>
          <h1 className="text-xl font-bold">{h.name}</h1>
          <div>{h.city}, {h.state} · CCN {h.ccn} · {h.type}{h.peer ? ` · Peer group: ${h.peer.label} (n=${h.peer.n})` : ''}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{STATUS_LABEL[hac?.status ?? 'no_score']}</div>
          <div>Printed {new Date().toLocaleDateString('en-US')}</div>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-4 gap-2">
        {[
          ['Total HAC Score', hac ? fmt(hac.total, 4) : '—', hac ? `${fmtSigned(hac.gap, 4)} vs cutoff ${fmt(hac.cutoff, 4)}` : 'Not scored'],
          ['Payment reduction', hac?.status === 'exempt' ? 'Exempt (Maryland)' : hac?.payment_reduction == null ? '—' : hac.payment_reduction ? '1% applied' : 'None', hac ? `FY${hac.fiscal_year} official` : ''],
          ['Est. 1% exposure', fmtUsd(hac?.exposure_usd), 'Estimate: 1% of Medicare inpatient payments'],
          ['Nurse communication', nurse?.value != null ? `${fmt(nurse.value, 0)}%` : '—', nurse ? `${fmtOrdinal(nurse.percentile_national)} pct. nationally` : ''],
        ].map(([l, v, c]) => (
          <div key={l} className="border border-black/40 p-2">
            <div className="text-[9px] font-semibold uppercase">{l}</div>
            <div className="text-base font-bold">{v}</div>
            <div className="text-[9px]">{c}</div>
          </div>
        ))}
      </section>

      {hac && (
        <section className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="mb-1 text-xs font-bold">What drives the score (weighted z, FY{hac.fiscal_year})</h2>
            <svg viewBox={`0 0 300 ${measures.length * 18 + 4}`} width="100%">
              <line x1="150" x2="150" y1="0" y2={measures.length * 18 + 4} stroke="#000" strokeWidth="0.6" />
              {measures.map((m, i) => {
                const w = (Math.abs(m.contribution as number) / maxAbs) * 80
                const pos = (m.contribution as number) >= 0
                return (
                  <g key={m.key} transform={`translate(0 ${i * 18 + 2})`}>
                    <text x="0" y="11" fontSize="9">{HAC_LABELS[m.key].split(' (')[0]}</text>
                    <rect x={pos ? 150 : 150 - w} y="2" width={Math.max(1, w)} height="12" fill={CAT_FILL[m.category]} />
                    <text x={pos ? 150 + w + 3 : 150 - w - 3} y="11" fontSize="9" textAnchor={pos ? 'start' : 'end'}>{fmtSigned(m.contribution, 3)}</text>
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
            <h2 className="mb-1 text-xs font-bold">{above ? 'Patients to prevent (one measure alone, approximate)' : 'Cushion before the penalty (approximate)'}</h2>
            <table className="w-full">
              <tbody>
                {(above ? ptp : cush).map((p) => {
                  const [one, many] = HAC_EVENT_NOUN[p.measure]
                  return (
                    <tr key={p.measure} className={`border-b border-black/20 ${p.measure === hac.tipping_measure && above ? 'font-bold' : ''}`}>
                      <td className="py-0.5">{HAC_LABELS[p.measure]}</td>
                      <td className="py-0.5 text-right">
                        {p.feasible && p.events != null ? `${above ? '~' : '+'}${p.events} ${p.events === 1 ? one : many}` : (p.reason ?? '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-1 text-[9px]">Holds peers and the cutoff constant. The cutoff moves every year.</p>
          </div>
        </section>
      )}

      {h.readmissions && h.readmissions.rows.length > 0 && (
        <section className="mt-3">
          <h2 className="mb-1 text-xs font-bold">Readmissions — excess readmission ratio (above 1.0 = excess)</h2>
          <div className="flex flex-wrap gap-x-4">
            {h.readmissions.rows.map((r) => (
              <span key={r.condition}>{r.label}: <b>{fmt(r.err, 3)}</b>{r.err != null && r.err > 1 ? ' ▲' : ''}</span>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-4 border-t border-black/40 pt-2 text-[8.5px]">
        <b>Sources (public CMS data):</b>{' '}
        {hac && `HAC Reduction Program yq43-i98g, FY${hac.fiscal_year} (PSI 90 ${fmtPeriod(hac.period.psi90)}; HAI ${fmtPeriod(hac.period.hai)}). `}
        {h.hai && `HAI ${h.hai.source} (${fmtPeriod(h.hai.period)}). `}
        {h.hcahps && `HCAHPS ${h.hcahps.source} (${fmtPeriod(h.hcahps.period)}). `}
        {h.readmissions && `HRRP ${h.readmissions.source} (${fmtPeriod(h.readmissions.period)}). `}
        {srcs.length > 0 && `CMS files modified: ${srcs.map((s) => `${s.id} ${s.modified ?? '—'}`).join(', ')}. `}
        Patients-to-prevent and exposure are CareSignal estimates. caresignal · built only on public CMS data.
      </footer>
    </article>
  )
}
