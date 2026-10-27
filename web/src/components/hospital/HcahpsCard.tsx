import { CategoryBadge } from '../ui'
import { fmt } from '../../lib/format'
import type { Hospital } from '../../lib/types'
import { NotReported, Panel, PanelTitle, Source } from './shared'
import { plain, sourceLine } from './helpers'

const ORDER = ['H_COMP_1_A_P', 'H_NURSE_RESPECT_A_P', 'H_NURSE_LISTEN_A_P', 'H_NURSE_EXPLAIN_A_P', 'H_COMP_6_Y_P', 'H_DISCH_HELP_Y_P', 'H_SYMPTOMS_Y_P']

/** Turn CMS survey labels like 'Nurse communication ("Always")' into plain questions. */
function surveyLabel(label: string): { text: string; answer: string | null } {
  const m = label.match(/^(.*?)\s*\("?([^")]+)"?\)\s*$/)
  return m ? { text: plain(m[1]), answer: m[2] } : { text: plain(label), answer: null }
}

/** Dot plot on a shared percent scale: hospital, similar hospitals, state and nation. */
function Track({ value, peer, state, nation }: { value: number | null; peer: number | null; state: number | null; nation: number | null }) {
  const all = [value, peer, state, nation].filter((x): x is number => x != null)
  if (!all.length) return null
  const lo = Math.max(0, Math.floor((Math.min(...all) - 5) / 5) * 5)
  const hi = Math.min(100, Math.ceil((Math.max(...all) + 5) / 5) * 5)
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="relative h-7" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#C9D2E3]" />
      <span className="absolute -bottom-1.5 left-0 text-[10px] text-muted">{lo}%</span>
      <span className="absolute -bottom-1.5 right-0 text-[10px] text-muted">{hi}%</span>
      {nation != null && <span className="absolute top-0.5 h-6 w-0.5 -translate-x-1/2 bg-[#58585A]" style={{ left: x(nation) }} />}
      {state != null && <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-[#5890A8] bg-surface" style={{ left: x(state) }} />}
      {peer != null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2F4F9E] bg-surface" style={{ left: x(peer) }} />}
      {value != null && <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#112659] ring-2 ring-white" style={{ left: x(value) }} />}
    </div>
  )
}

export default function HcahpsCard({ h }: { h: Hospital }) {
  const hc = h.hcahps
  const items = hc ? [...hc.items].sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99)) : []
  const nurse = items.find((i) => i.id === 'H_COMP_1_A_P')
  return (
    <Panel labelledBy="hcahps-h">
      <PanelTitle
        id="hcahps-h"
        title="What patients said about their stay"
        helper="After a hospital stay, Medicare surveys patients. Each number is the share of patients who gave the best answer, such as saying nurses “always” communicated well. Higher is better."
      />
      {!hc || !items.length ? (
        <p className="text-[15px] text-muted">Medicare did not report survey results for this hospital. This is common for small hospitals with too few completed surveys.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x sm:divide-[#C9D2E3] sm:[&>*:not(:first-child)]:pl-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Nurse communication</div>
              <div className="tabular mt-1 text-5xl font-light text-ink">{nurse?.value != null ? `${fmt(nurse.value, 0)}%` : 'N/A'}</div>
              <div className="mt-1 text-sm text-muted">
                {nurse?.percentile_national != null ? `Better than ${Math.round(nurse.percentile_national)}% of hospitals in the nation` : 'Of patients said nurses always communicated well'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Survey star rating</div>
              <div className="tabular mt-1 text-5xl font-light text-ink">{hc.star != null ? `${hc.star} of 5` : 'N/A'}</div>
              <div className="mt-1 text-sm text-muted">Medicare’s summary of all survey answers</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Surveys completed</div>
              <div className="tabular mt-1 text-5xl font-light text-ink">{fmt(hc.surveys, 0)}</div>
              <div className="mt-1 text-sm text-muted">{hc.response_rate != null ? `${fmt(hc.response_rate, 0)}% of patients asked responded` : 'Response rate not reported'}</div>
            </div>
          </div>
          <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink" aria-label="Chart key">
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3.5 w-3.5 rounded-full bg-[#112659]" />This hospital</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-3 w-3 rounded-full border-2 border-[#2F4F9E]" />Similar hospitals (middle)</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rotate-45 border-2 border-[#5890A8]" />State</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden className="h-4 w-0.5 bg-[#58585A]" />Nation</li>
          </ul>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <caption className="sr-only">Patient survey results compared with similar hospitals, the state and the nation</caption>
              <thead>
                <tr className="border-b-2 border-[#112659] text-left text-xs font-bold uppercase tracking-wider text-ink">
                  <th scope="col" className="py-2 pr-3">Survey question</th>
                  <th scope="col" className="py-2 pr-3 text-right">This hospital</th>
                  <th scope="col" className="w-[30%] py-2 pr-3"><span className="sr-only">Comparison chart</span></th>
                  <th scope="col" className="py-2 pr-3 text-right">Similar</th>
                  <th scope="col" className="py-2 pr-3 text-right">State</th>
                  <th scope="col" className="py-2 text-right">Nation</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {items.map((i) => {
                  const l = surveyLabel(i.label)
                  return (
                    <tr key={i.id} className="border-b border-[#C9D2E3] last:border-0">
                      <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">
                        {l.text}
                        {l.answer && <span className="mt-0.5 block text-xs font-normal text-muted">Share answering “{l.answer.toLowerCase()}”</span>}
                        <span className="mt-1 block"><CategoryBadge category={i.category} /></span>
                      </th>
                      <td className="py-3 pr-3 text-right text-lg font-semibold">{i.value != null ? `${fmt(i.value, 0)}%` : <NotReported footnote={i.footnote} what={l.text} />}</td>
                      <td className="py-3 pr-3"><Track value={i.value} peer={i.peer_median} state={i.state} nation={i.national} /></td>
                      <td className="py-3 pr-3 text-right text-muted">{i.peer_median != null ? `${fmt(i.peer_median, 0)}%` : 'N/A'}</td>
                      <td className="py-3 pr-3 text-right text-muted">{i.state != null ? `${fmt(i.state, 0)}%` : 'N/A'}</td>
                      <td className="py-3 text-right text-muted">{i.national != null ? `${fmt(i.national, 0)}%` : 'N/A'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Source>{hc ? sourceLine('patient survey (HCAHPS)', hc.period, 'State and national results from the CMS state and national survey files') : 'CMS patient survey (HCAHPS)'}</Source>
    </Panel>
  )
}
