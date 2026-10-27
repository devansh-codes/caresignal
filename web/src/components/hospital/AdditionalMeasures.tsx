import { CategoryBadge } from '../ui'
import { fmt } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { ComparedBadge, NotReported, Source } from './shared'
import { plain, sourceLine } from './helpers'

/** Individual patient safety indicators behind the combined safety events rate. */
export function SafetyIndicators({ h }: { h: Hospital }) {
  const psi = h.psi
  return (
    <div>
      <p className="mb-3 text-[15px] text-muted">
        These are the separate safety problems that make up the combined patient safety events rate. Pressure ulcers and falls with a broken hip are the ones nurses influence most. Rates are per 1,000 eligible patients, adjusted for how sick patients were.
      </p>
      {!psi?.rows.length ? (
        <p className="text-sm text-muted">Medicare did not report these results for this hospital.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Patient safety indicator rates</caption>
            <thead>
              <tr className="border-b-2 border-[#112659] text-left text-xs font-bold uppercase tracking-wider text-ink">
                <th scope="col" className="py-2 pr-3">Safety problem</th>
                <th scope="col" className="py-2 pr-3">Who owns it</th>
                <th scope="col" className="py-2 pr-3 text-right">Rate</th>
                <th scope="col" className="py-2">Compared with nation</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {psi.rows.map((r) => (
                <tr key={r.id} className="border-b border-[#C9D2E3] last:border-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-semibold text-ink">
                    {plain(r.label).replace(/\s*\(six digit estimate\)/i, '').replace(/ rate$/i, '')}
                    <span className="block text-xs font-normal text-muted">{r.id.replace('_', ' ')}</span>
                  </th>
                  <td className="py-2.5 pr-3"><CategoryBadge category={r.category} /></td>
                  <td className="py-2.5 pr-3 text-right">{r.rate != null ? fmt(r.rate, 2) : <NotReported footnote={r.footnote} what={r.label} />}</td>
                  <td className="py-2.5"><ComparedBadge text={r.compared_to_national} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Source>{psi ? sourceLine('patient safety indicator file', psi.period, 'Based on Medicare claims') : 'CMS patient safety indicator file'}</Source>
    </div>
  )
}

/** Sepsis care and the separate Value Based Purchasing score. */
export function SepsisAndVbp({ h }: { h: Hospital }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:divide-x md:divide-[#C9D2E3] md:[&>*:last-child]:pl-8">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Sepsis care</div>
        <p className="tabular mt-1 text-5xl font-light text-ink">{h.sep1?.score != null ? `${fmt(h.sep1.score, 0)}%` : <NotReported footnote={h.sep1?.footnote} what="sepsis care" />}</p>
        <p className="mt-1 text-sm text-muted">Share of patients with severe sepsis who got every recommended step of care on time. Higher is better. Nurses and doctors share this work.</p>
        <Source>{h.sep1 ? sourceLine('Timely and Effective Care file (SEP 1)', h.sep1.period) : 'CMS Timely and Effective Care file'}</Source>
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Value Based Purchasing score</div>
        {h.vbp ? (
          <>
            <p className="tabular mt-1 text-5xl font-light text-ink">{fmt(h.vbp.tps, 1)}</p>
            <p className="mt-1 text-sm text-muted">
              A separate Medicare program that can raise or lower payments based on quality. Higher is better.
              {h.vbp.tps_percentile != null && ` This hospital scored better than ${Math.round(h.vbp.tps_percentile)}% of hospitals.`}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular">
              <dt className="text-muted">Clinical results</dt><dd className="text-right text-ink">{fmt(h.vbp.domains.clinical, 1)}</dd>
              <dt className="text-muted">Patient experience</dt><dd className="text-right text-ink">{fmt(h.vbp.domains.engagement, 1)}</dd>
              <dt className="text-muted">Safety</dt><dd className="text-right text-ink">{fmt(h.vbp.domains.safety, 1)}</dd>
              <dt className="text-muted">Cost efficiency</dt><dd className="text-right text-ink">{fmt(h.vbp.domains.efficiency, 1)}</dd>
            </dl>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">Not reported. The hospital is not in this program or had too little data.</p>
        )}
        <Source>{h.vbp ? `CMS Hospital Value Based Purchasing, FY${h.vbp.fiscal_year}` : 'CMS Hospital Value Based Purchasing'}</Source>
      </div>
    </div>
  )
}
