import { Card, SourceNote } from '../ui'
import { fmt } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { NotReported } from './shared'
import { sourceLine } from './helpers'

export default function ReadmissionTable({ h }: { h: Hospital }) {
  const r = h.readmissions
  const rows = r?.rows ?? []
  const excess = rows.filter((x) => x.err != null && x.err > 1).length
  return (
    <Card
      title="Readmissions (HRRP)"
      subtitle="Excess readmission ratio (ERR) = predicted ÷ expected 30-day readmissions. Above 1.0 means more readmissions than expected and counts toward the HRRP penalty."
      action={rows.length ? <span className="text-sm font-semibold text-ink tabular">{excess} of {rows.filter((x) => x.err != null).length} above 1.0</span> : undefined}
    >
      {!rows.length ? (
        <p className="text-sm text-muted">HRRP results not reported by CMS for this hospital.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Excess readmission ratios by condition</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">Condition</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">ERR</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Discharges</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Readmissions</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Predicted</th>
                <th scope="col" className="py-1.5 text-right font-medium">Expected</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((x) => {
                const hi = x.err != null && x.err > 1
                return (
                  <tr key={x.condition} className={`border-b border-border/60 last:border-0 ${hi ? 'bg-critical/5' : ''}`}>
                    <th scope="row" className="py-2 pr-3 text-left font-medium">{x.label}</th>
                    <td className={`py-2 pr-3 text-right font-semibold ${hi ? 'text-critical' : 'text-ink'}`}>
                      {x.err != null ? (
                        <span className="inline-flex items-center gap-1">
                          {hi && <span aria-hidden>▲</span>}
                          {fmt(x.err, 4)}
                          {hi && <span className="sr-only">(above 1.0, excess readmissions)</span>}
                        </span>
                      ) : (
                        <NotReported footnote={x.footnote} what={x.label} />
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmt(x.discharges, 0)}</td>
                    <td className="py-2 pr-3 text-right">{x.readmissions ?? '—'}</td>
                    <td className="py-2 pr-3 text-right text-muted">{x.predicted_rate != null ? `${fmt(x.predicted_rate, 1)}%` : '—'}</td>
                    <td className="py-2 text-right text-muted">{x.expected_rate != null ? `${fmt(x.expected_rate, 1)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Discharge education and care transitions are shared nursing work.</p>
      <SourceNote>{r ? sourceLine(r.source, 'Hospital Readmissions Reduction Program', r.period) : 'CMS HRRP (9n3s-kdb3)'}</SourceNote>
    </Card>
  )
}
