import { Card, CategoryBadge, SourceNote } from '../ui'
import { HAC_EVENT_NOUN, HAC_LABELS, fmt } from '../../lib/format'
import type { HacMeasureKey, PatientsToPrevent as Ptp } from '../../lib/types'
import type { HacViewModel } from './viewModel'

const HAI: HacMeasureKey[] = ['cauti', 'clabsi', 'cdi', 'mrsa', 'ssi']

/** One card per infection measure: whole infections to prevent (or the cushion when clear). */
export default function PatientsToPrevent({ vm }: { vm: HacViewModel }) {
  const above = vm.gap != null && vm.gap > 0
  const list: (Ptp | undefined)[] = HAI.map((k) => (above ? vm.ptp : (vm.cushion ?? vm.ptp)).find((p) => p.measure === k))
  const tipping = above
    ? vm.tipping
    : (vm.cushion ?? []).filter((p) => p.feasible && p.events != null).sort((a, b) => (a.events as number) - (b.events as number))[0]?.measure ?? null

  return (
    <Card
      title={above ? 'Patients to prevent' : 'Cushion before the penalty'}
      subtitle={
        above
          ? 'Fewest infections, avoided in one measure alone, that would bring the Total HAC Score to or below the cutoff.'
          : 'Added infections in one measure alone that would push this hospital above the cutoff.'
      }
    >
      {vm.status === 'exempt' && (
        <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">
          Maryland hospitals are waived from the HAC payment reduction under the All-Payer Model. These figures show only the hospital&apos;s position relative to the national cutoff.
        </p>
      )}
      {vm.gap == null ? (
        <p className="text-sm text-muted">No total score in this view.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {HAI.map((k, i) => {
            const p = list[i]
            const m = vm.measures.find((x) => x.key === k)!
            const isTip = tipping === k
            const [one, many] = HAC_EVENT_NOUN[k]
            const hasResult = m.weight > 0
            return (
              <li
                key={k}
                className={`relative flex flex-col rounded-card border p-3 ${
                  isTip ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-surface'
                }`}
              >
                {isTip && (
                  <span className="absolute -top-2.5 left-3 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-ink">
                    {above ? 'Tipping measure' : 'Thinnest cushion'}
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{HAC_LABELS[k]}</span>
                  <CategoryBadge category={m.category} />
                </div>
                {!hasResult ? (
                  <p className="mt-2 text-sm text-muted">No result for this measure; it carries no weight.</p>
                ) : p?.feasible && p.events != null ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold tabular text-ink">
                      {above ? '~' : '+'}
                      {p.events}
                      <span className="ml-1 text-sm font-medium text-muted">{p.events === 1 ? one : many}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {above ? 'fewer → clears cutoff' : 'more → crosses cutoff'} · Δ SIR {fmt(p.delta_sir, 3)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">{p?.reason ?? 'Not computable for this measure'}</p>
                )}
                <dl className="mt-auto grid grid-cols-3 gap-1 pt-3 text-[11px] text-muted">
                  <div><dt>SIR</dt><dd className="tabular text-ink">{fmt(m.value, 3)}</dd></div>
                  <div><dt>Observed</dt><dd className="tabular text-ink">{fmt(m.observed, 0)}</dd></div>
                  <div><dt>Predicted</dt><dd className="tabular text-ink">{fmt(m.predicted, 1)}</dd></div>
                </dl>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
        <strong className="font-semibold text-ink">Approximate.</strong> Holds peer performance and the cutoff constant, and the real cutoff moves every year.
        {vm.view === 'program' && ' Program-year SIRs come from the FY2026 HAC file. Predicted counts come from the current HAI file (a later period) as a proxy.'}
        {' '}PSI 90 is a composite rate, so it has no infection count.
      </p>
      <SourceNote>CareSignal calculation · ΔSIR = (gap ÷ weight) × SD of Winsorized SIRs · infections = ⌈ΔSIR × predicted⌉ · CMS yq43-i98g + 77hc-ibv8</SourceNote>
    </Card>
  )
}
