import { fmt } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { NotReported, Panel, PanelTitle, Source } from './shared'
import { plain, sourceLine } from './helpers'

export default function ReadmissionTable({ h }: { h: Hospital }) {
  const r = h.readmissions
  const rows = r?.rows ?? []
  const reported = rows.filter((x) => x.err != null)
  const excess = reported.filter((x) => (x.err as number) > 1).length
  return (
    <Panel labelledBy="readm-h">
      <PanelTitle
        id="readm-h"
        title="Patients coming back within 30 days"
        helper="For each condition, Medicare compares how many patients returned to the hospital within 30 days with how many it expected. A ratio of 1.0 means as expected. Above 1.0 means more returns than expected, which counts toward a separate Medicare penalty."
      />
      {!rows.length ? (
        <p className="text-[15px] text-muted">Medicare did not report readmission results for this hospital.</p>
      ) : (
        <>
          <p className="mb-4 text-lg text-ink">
            <strong className="text-2xl font-light tabular">{excess}</strong> of {reported.length} reported conditions had more returns than expected.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <caption className="sr-only">Readmission ratio by condition</caption>
              <thead>
                <tr className="border-b-2 border-[#112659] text-left text-xs font-bold uppercase tracking-wider text-ink">
                  <th scope="col" className="py-2 pr-3">Condition</th>
                  <th scope="col" className="py-2 pr-3 text-right">Readmission ratio</th>
                  <th scope="col" className="py-2 pr-3 text-right">Patients</th>
                  <th scope="col" className="py-2 pr-3 text-right">Came back</th>
                  <th scope="col" className="py-2 pr-3 text-right">Adjusted rate here</th>
                  <th scope="col" className="py-2 text-right">Rate expected</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((x) => {
                  const hi = x.err != null && x.err > 1
                  return (
                    <tr key={x.condition} className={`border-b border-[#C9D2E3] last:border-0 ${hi ? 'bg-critical/5' : ''}`}>
                      <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">{plain(x.label).replace('/', ' or ')}</th>
                      <td className={`py-3 pr-3 text-right text-lg font-semibold ${hi ? 'text-critical' : 'text-ink'}`}>
                        {x.err != null ? (
                          <span className="inline-flex items-center gap-1">
                            {hi && <span aria-hidden>▲</span>}
                            {fmt(x.err, 2)}
                            {hi && <span className="sr-only">, more returns than expected</span>}
                          </span>
                        ) : (
                          <NotReported footnote={x.footnote} what={x.label} />
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right">{fmt(x.discharges, 0)}</td>
                      <td className="py-3 pr-3 text-right">{x.readmissions == null ? 'N/A' : /too few/i.test(x.readmissions) ? 'Too few to report' : x.readmissions}</td>
                      <td className="py-3 pr-3 text-right text-muted">{x.predicted_rate != null ? `${fmt(x.predicted_rate, 1)}%` : 'N/A'}</td>
                      <td className="py-3 text-right text-muted">{x.expected_rate != null ? `${fmt(x.expected_rate, 1)}%` : 'N/A'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">Clear discharge teaching and follow up after the patient goes home are shared nursing work, so nurses can help lower these numbers.</p>
        </>
      )}
      <Source>{r ? sourceLine('Hospital Readmissions Reduction Program', r.period) : 'CMS Hospital Readmissions Reduction Program'}</Source>
    </Panel>
  )
}
