import { Card, CategoryBadge, SourceNote } from '../ui'
import { fmt } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { ComparedBadge, NotReported } from './shared'
import { sourceLine } from './helpers'

/** SIR point estimate with 95% CI and the 1.0 (national baseline) reference. */
function CiBar({ sir, lo, hi, max }: { sir: number | null; lo: number | null; hi: number | null; max: number }) {
  if (sir == null) return null
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="relative h-5 w-full min-w-[120px]" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="absolute top-0 h-5 w-px bg-muted" style={{ left: x(1) }} title="SIR 1.0 = national baseline" />
      {lo != null && hi != null && (
        <span className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-other/50" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
      )}
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface" style={{ left: x(sir) }} />
    </div>
  )
}

export default function HaiTable({ h }: { h: Hospital }) {
  const hai = h.hai
  const rows = hai?.rows ?? []
  const max = Math.max(2, ...rows.map((r) => r.ci_upper ?? r.sir ?? 0).filter((v) => Number.isFinite(v)))
  return (
    <Card title="Healthcare-associated infections" subtitle="Current HAI file. SIR = observed ÷ predicted infections; 1.0 equals the national baseline, and lower is better.">
      {!rows.length ? (
        <p className="text-sm text-muted">HAI results not reported by CMS for this hospital.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <caption className="sr-only">Standardized infection ratios with confidence intervals</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">Infection</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">SIR</th>
                <th scope="col" className="w-[28%] py-1.5 pr-3 font-medium">95% CI (0 – {fmt(max, 1)})</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Obs / Pred</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Device days</th>
                <th scope="col" className="py-1.5 font-medium">vs national</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    <div className="flex flex-col gap-0.5"><span>{r.label}</span><span><CategoryBadge category={r.category} /></span></div>
                  </th>
                  <td className="py-2 pr-3 text-right font-semibold">{r.sir != null ? fmt(r.sir, 3) : <NotReported footnote={r.footnote} what={r.label} />}</td>
                  <td className="py-2 pr-3">
                    <CiBar sir={r.sir} lo={r.ci_lower} hi={r.ci_upper} max={max} />
                    {r.sir != null && <span className="sr-only">95% CI {fmt(r.ci_lower, 3)} to {fmt(r.ci_upper, 3)}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right">{fmt(r.observed, 0)} / {fmt(r.predicted, 2)}</td>
                  <td className="py-2 pr-3 text-right text-muted">{fmt(r.device_days, 0)}</td>
                  <td className="py-2"><ComparedBadge text={r.compared_to_national} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Small predicted counts make SIRs unstable; wide intervals mean the result could easily be due to chance.</p>
      <SourceNote>{hai ? sourceLine(hai.source, 'Healthcare Associated Infections – Hospital', hai.period) : 'CMS HAI (77hc-ibv8)'}</SourceNote>
    </Card>
  )
}
