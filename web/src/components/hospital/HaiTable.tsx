import { CategoryBadge } from '../ui'
import { fmt } from '../../lib/format'
import type { HaiKey, Hospital } from '../../lib/types'
import { ComparedBadge, NotReported, Panel, PanelTitle, Source } from './shared'
import { sourceLine } from './helpers'

const LABEL: Record<HaiKey, [string, string]> = {
  clabsi: ['Central line infections', 'CLABSI'],
  cauti: ['Catheter infections', 'CAUTI'],
  ssi_colon: ['Surgical site infections after colon surgery', 'SSI colon'],
  ssi_hyst: ['Surgical site infections after hysterectomy', 'SSI abdominal hysterectomy'],
  mrsa: ['MRSA bloodstream infections', 'MRSA bacteremia'],
  cdi: ['C. diff infections', 'CDI'],
}

/** Rate dot with its likely range and the 1.0 "as expected" marker. */
function RangeBar({ sir, lo, hi, max }: { sir: number | null; lo: number | null; hi: number | null; max: number }) {
  if (sir == null) return null
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div className="relative h-6 w-full min-w-[140px]" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#C9D2E3]" />
      <span className="absolute top-0 h-6 w-0.5 bg-[#112659]/60" style={{ left: x(1) }} />
      {lo != null && hi != null && <span className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-[#9FC2D1]" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />}
      <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#112659] ring-2 ring-white" style={{ left: x(sir) }} />
    </div>
  )
}

export default function HaiTable({ h }: { h: Hospital }) {
  const hai = h.hai
  const rows = hai?.rows ?? []
  const max = Math.max(2, ...rows.map((r) => r.ci_upper ?? r.sir ?? 0).filter((v) => Number.isFinite(v)))
  return (
    <Panel labelledBy="hai-h">
      <PanelTitle
        id="hai-h"
        title="Infections caught in the hospital"
        helper="For each infection, Medicare compares how many happened with how many it expected for a hospital like this one. A rate of 1.0 means exactly as expected. Lower is better."
      />
      {!rows.length ? (
        <p className="text-[15px] text-muted">Medicare did not report infection results for this hospital.</p>
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink" aria-label="Chart key">
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full bg-[#112659]" />This hospital</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-1.5 w-5 bg-[#9FC2D1]" />Likely range</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-4 w-0.5 bg-[#112659]/60" />1.0 = as expected</li>
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Infection rates compared with what was expected</caption>
              <thead>
                <tr className="border-b-2 border-[#112659] text-left text-xs font-bold uppercase tracking-wider text-ink">
                  <th scope="col" className="py-2 pr-3">Infection</th>
                  <th scope="col" className="py-2 pr-3 text-right">Rate vs expected</th>
                  <th scope="col" className="w-[26%] py-2 pr-3">Likely range</th>
                  <th scope="col" className="py-2 pr-3 text-right">Actual / expected</th>
                  <th scope="col" className="py-2">Compared with nation</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-[#C9D2E3] last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">
                      {LABEL[r.key]?.[0] ?? r.label}
                      <span className="mt-0.5 block text-xs font-normal text-muted">{LABEL[r.key]?.[1]}</span>
                      <span className="mt-1 block"><CategoryBadge category={r.category} /></span>
                    </th>
                    <td className="py-3 pr-3 text-right text-lg font-semibold">{r.sir != null ? fmt(r.sir, 2) : <NotReported footnote={r.footnote} what={LABEL[r.key]?.[0]} />}</td>
                    <td className="py-3 pr-3">
                      <RangeBar sir={r.sir} lo={r.ci_lower} hi={r.ci_upper} max={max} />
                      {r.sir != null && <span className="sr-only">Likely range {fmt(r.ci_lower, 2)} to {fmt(r.ci_upper, 2)}</span>}
                    </td>
                    <td className="py-3 pr-3 text-right">{fmt(r.observed, 0)} of {fmt(r.predicted, 1)}</td>
                    <td className="py-3"><ComparedBadge text={r.compared_to_national} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">When a hospital expects only a few infections, one more or one fewer changes the rate a lot. A wide likely range means the result could be chance.</p>
        </>
      )}
      <Source>{hai ? sourceLine('Healthcare Associated Infections file', hai.period) : 'CMS Healthcare Associated Infections file'}</Source>
    </Panel>
  )
}
