import { Card, CategoryBadge, SourceNote } from '../ui'
import { fmt, fmtOrdinal } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { NotReported } from './shared'
import { sourceLine } from './helpers'

const ORDER = ['H_COMP_1_A_P', 'H_NURSE_RESPECT_A_P', 'H_NURSE_LISTEN_A_P', 'H_NURSE_EXPLAIN_A_P', 'H_COMP_6_Y_P', 'H_DISCH_HELP_Y_P', 'H_SYMPTOMS_Y_P']

/** Dot plot on a shared 0–100% scale: hospital vs peer median, state and nation. */
function Track({ value, peer, state, nation }: { value: number | null; peer: number | null; state: number | null; nation: number | null }) {
  const all = [value, peer, state, nation].filter((x): x is number => x != null)
  if (!all.length) return null
  const lo = Math.max(0, Math.floor((Math.min(...all) - 5) / 5) * 5)
  const hi = Math.min(100, Math.ceil((Math.max(...all) + 5) / 5) * 5)
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="relative h-6" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="absolute -bottom-1 left-0 text-[9px] text-muted">{lo}%</span>
      <span className="absolute -bottom-1 right-0 text-[9px] text-muted">{hi}%</span>
      {nation != null && <span className="absolute top-0.5 h-5 w-0.5 -translate-x-1/2 bg-ink" style={{ left: x(nation) }} />}
      {state != null && <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-muted bg-surface" style={{ left: x(state) }} />}
      {peer != null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-other bg-surface" style={{ left: x(peer) }} />}
      {value != null && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface" style={{ left: x(value) }} />}
    </div>
  )
}

export default function HcahpsCard({ h }: { h: Hospital }) {
  const hc = h.hcahps
  const items = hc ? [...hc.items].sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99)) : []
  return (
    <Card
      title="Patient experience (HCAHPS)"
      subtitle="Nurse communication and discharge measures stay in the VBP Patient Experience domain through at least FY2030."
    >
      {!hc || !items.length ? (
        <p className="text-sm text-muted">HCAHPS results not reported by CMS for this hospital (common for small hospitals with too few completed surveys).</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-muted">HCAHPS summary star </span><span className="font-semibold">{hc.star != null ? `${hc.star}/5` : '—'}</span></span>
            <span><span className="text-muted">Completed surveys </span><span className="tabular font-semibold">{fmt(hc.surveys, 0)}</span></span>
            <span><span className="text-muted">Response rate </span><span className="tabular font-semibold">{hc.response_rate != null ? `${fmt(hc.response_rate, 0)}%` : '—'}</span></span>
          </div>
          <ul className="mb-2 flex flex-wrap gap-4 text-xs text-muted" aria-label="Legend">
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-primary" />This hospital</li>
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full border-2 border-other" />Peer median</li>
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rotate-45 border-2 border-muted" />State</li>
            <li className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-0.5 bg-ink" />Nation</li>
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <caption className="sr-only">HCAHPS top-box results versus peer median, state and nation</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Measure</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">Hospital</th>
                  <th scope="col" className="w-[36%] py-1.5 pr-3 font-medium"><span className="sr-only">Position</span></th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">Peer</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">State</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-medium">Nation</th>
                  <th scope="col" className="py-1.5 text-right font-medium">Pctl. (nat.)</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{i.label}</span>
                        <span><CategoryBadge category={i.category} /></span>
                      </div>
                    </th>
                    <td className="py-2 pr-3 text-right text-base font-semibold">{i.value != null ? `${fmt(i.value, 0)}%` : <NotReported footnote={i.footnote} what={i.label} />}</td>
                    <td className="py-2 pr-3"><Track value={i.value} peer={i.peer_median} state={i.state} nation={i.national} /></td>
                    <td className="py-2 pr-3 text-right text-muted">{i.peer_median != null ? `${fmt(i.peer_median, 0)}%` : '—'}</td>
                    <td className="py-2 pr-3 text-right text-muted">{i.state != null ? `${fmt(i.state, 0)}%` : '—'}</td>
                    <td className="py-2 pr-3 text-right text-muted">{i.national != null ? `${fmt(i.national, 0)}%` : '—'}</td>
                    <td className="py-2 text-right">{fmtOrdinal(i.percentile_national)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <SourceNote>{hc ? sourceLine(hc.source, 'Patient survey (HCAHPS) – Hospital', hc.period, 'benchmarks from 99ue-w85f (national) and 84jm-wiui (state)') : 'CMS HCAHPS (dgck-syfz)'}</SourceNote>
    </Card>
  )
}
