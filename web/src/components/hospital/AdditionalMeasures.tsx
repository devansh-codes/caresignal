import { CategoryBadge, SourceNote } from '../ui'
import { fmt, fmtOrdinal } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { ComparedBadge, Disclosure, NotReported } from './shared'
import { sourceLine } from './helpers'

/** Lower-priority detail behind progressive disclosure: PSI components, SEP-1 and VBP. */
export default function AdditionalMeasures({ h }: { h: Hospital }) {
  const psi = h.psi
  return (
    <div className="space-y-3">
      <Disclosure summary={<span>Patient safety indicators (PSI) <span className="font-normal text-muted">· {psi?.rows.length ?? 0} measures</span></span>}>
        {!psi?.rows.length ? (
          <p className="text-sm text-muted">PSI results not reported by CMS for this hospital.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Patient safety indicator rates</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Indicator</th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">Category</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">Rate</th>
                  <th scope="col" className="py-1.5 font-medium">vs national</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {psi.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                      <span className="mr-1.5 font-mono text-xs text-muted">{r.id.replace('_', ' ')}</span>
                      {r.label}
                    </th>
                    <td className="py-1.5 pr-3"><CategoryBadge category={r.category} /></td>
                    <td className="py-1.5 pr-3 text-right">{r.rate != null ? fmt(r.rate, r.id === 'PSI_90' ? 4 : 2) : <NotReported footnote={r.footnote} what={r.label} />}</td>
                    <td className="py-1.5"><ComparedBadge text={r.compared_to_national} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted">PSI 03 (pressure ulcer) and PSI 08 (in-hospital fall with hip fracture) are nursing-sensitive. Rates are per 1,000 eligible discharges, risk-adjusted, and derived from Medicare FFS claims.</p>
        <SourceNote>{psi ? sourceLine(psi.source, 'PSI-90 six-digit estimate / Complications and Deaths', psi.period) : 'CMS muwa-iene, ynj2-r877'}</SourceNote>
      </Disclosure>

      <Disclosure summary={<span>Sepsis bundle (SEP-1) and Value-Based Purchasing</span>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">SEP-1 severe sepsis & septic shock bundle</h3>
            <p className="mt-1 text-2xl font-semibold tabular">{h.sep1?.score != null ? `${fmt(h.sep1.score, 0)}%` : <NotReported footnote={h.sep1?.footnote} what="SEP-1" />}</p>
            <p className="text-xs text-muted">Share of eligible patients who received appropriate care (higher is better). A shared nursing–medical process measure.</p>
            <SourceNote>{h.sep1 ? sourceLine(h.sep1.source, 'Timely and Effective Care', h.sep1.period) : 'CMS yv7e-xc69'}</SourceNote>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Hospital VBP Total Performance Score</h3>
            {h.vbp ? (
              <>
                <p className="mt-1 text-2xl font-semibold tabular">
                  {fmt(h.vbp.tps, 1)} <span className="text-sm font-medium text-muted">· {fmtOrdinal(h.vbp.tps_percentile)} percentile</span>
                </p>
                <dl className="mt-2 grid grid-cols-1 grid-cols-2 gap-x-4 gap-y-1 text-xs tabular">
                  <dt className="text-muted">Clinical outcomes</dt><dd className="text-right">{fmt(h.vbp.domains.clinical, 2)}</dd>
                  <dt className="text-muted">Person & community engagement</dt><dd className="text-right">{fmt(h.vbp.domains.engagement, 2)}</dd>
                  <dt className="text-muted">Safety</dt><dd className="text-right">{fmt(h.vbp.domains.safety, 2)}</dd>
                  <dt className="text-muted">Efficiency & cost reduction</dt><dd className="text-right">{fmt(h.vbp.domains.efficiency, 2)}</dd>
                </dl>
                <p className="mt-1 text-[11px] text-muted">Weighted domain scores.</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Not reported by CMS (hospital not in the FY VBP program or insufficient data).</p>
            )}
            <SourceNote>{h.vbp ? `CMS HVBP Total Performance Score (${h.vbp.source}) · FY${h.vbp.fiscal_year}` : 'CMS ypbt-wvdk'}</SourceNote>
          </div>
        </div>
      </Disclosure>
    </div>
  )
}
