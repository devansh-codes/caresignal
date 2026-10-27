import { CategoryBadge } from '../ui'
import { HAC_LABELS, HAC_TECH_LABELS, fmt } from '../../lib/format'
import type { HacMeasureKey, PatientsToPrevent as Ptp } from '../../lib/types'
import type { HacViewModel } from './viewModel'
import { noun, plainReason } from './helpers'
import { Note, Source } from './shared'

const HAI: HacMeasureKey[] = ['cauti', 'clabsi', 'cdi', 'mrsa', 'ssi']

/** One card per infection type: how many fewer would clear the line (or how many more would cross it). */
export default function PatientsToPrevent({ vm }: { vm: HacViewModel }) {
  const above = vm.gap != null && vm.gap > 0
  const list: (Ptp | undefined)[] = HAI.map((k) => (above ? vm.ptp : (vm.cushion ?? vm.ptp)).find((p) => p.measure === k))
  const tipping = above
    ? vm.tipping
    : (vm.cushion ?? []).filter((p) => p.feasible && p.events != null).sort((a, b) => (a.events as number) - (b.events as number))[0]?.measure ?? null

  return (
    <div>
      <p className="mb-5 max-w-3xl text-[15px] leading-relaxed text-muted">
        <span className="font-semibold text-ink">How to read this: </span>
        {above
          ? 'Each card shows how many fewer infections of one type, on their own, would bring this hospital below the penalty line. The highlighted card is the smallest number, so it is the biggest opportunity.'
          : 'Each card shows how many more infections of one type, on their own, would push this hospital above the penalty line. The highlighted card is the type with the least room to spare.'}
      </p>
      {vm.status === 'exempt' && (
        <p className="mb-4 bg-surface-2 px-4 py-3 text-sm text-muted">
          Maryland hospitals are exempt from this penalty. These numbers only show where the hospital sits compared with the national line.
        </p>
      )}
      {vm.gap == null ? (
        <p className="text-sm text-muted">There is no safety score for this view.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {HAI.map((k, i) => {
            const p = list[i]
            const m = vm.measures.find((x) => x.key === k)!
            const isTip = tipping === k
            const hasResult = m.weight > 0
            return (
              <li
                key={k}
                className={`relative flex flex-col bg-surface p-5 ${isTip ? 'border-2 border-[#FECA71] shadow-[0_0_0_2px_rgba(254,202,113,0.35)]' : 'border border-[#C9D2E3]'}`}
              >
                {isTip && (
                  <span className="absolute -top-3 left-4 bg-[#FECA71] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#112659]">
                    {above ? 'Biggest opportunity' : 'Least room to spare'}
                  </span>
                )}
                <div className="flex flex-col gap-1.5">
                  <span className="text-base font-bold text-ink">{HAC_LABELS[k]}</span>
                  <span className="text-xs text-muted">{HAC_TECH_LABELS[k]}</span>
                  <span><CategoryBadge category={m.category} /></span>
                </div>
                {!hasResult ? (
                  <p className="mt-3 text-sm text-muted">No result reported for this infection, so it does not count toward the score.</p>
                ) : p?.feasible && p.events != null ? (
                  <>
                    <p className="mt-3 text-5xl font-light tabular text-ink">{p.events}</p>
                    <p className="mt-1 text-sm text-ink">
                      {above ? 'fewer' : 'more'} {noun(k, p.events)}
                      <span className="block text-muted">{above ? 'would bring it below the line' : 'would push it over the line'}</span>
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted">{plainReason(p?.reason)}</p>
                )}
                {hasResult && (
                  <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-[#C9D2E3] pt-3 text-xs text-muted">
                    <div><dt>Actual</dt><dd className="tabular text-sm font-semibold text-ink">{fmt(m.observed, 0)}</dd></div>
                    <div><dt>Expected</dt><dd className="tabular text-sm font-semibold text-ink">{fmt(m.predicted, 1)}</dd></div>
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Note>
        <strong className="text-ink">These are estimates.</strong> They assume other hospitals stay the same and the penalty line does not move, but the line changes every year.
        {vm.view === 'program' && ' Expected counts come from the most recent infection file, which covers a later period than the official score.'}{' '}
        Patient safety events are reported as one combined rate, so they have no count here.
      </Note>
      <Source>CareSignal estimate using CMS Hospital Acquired Condition Reduction Program scores and expected infection counts from the CMS Healthcare Associated Infections file</Source>
    </div>
  )
}
