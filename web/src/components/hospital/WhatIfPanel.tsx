import { useMemo, useState } from 'react'
import { StatusPill } from '../ui'
import { HAC_LABELS, STATUS_LABEL, fmt } from '../../lib/format'
import { Note, Source } from './shared'
import { lower } from './helpers'
import type { HacMeasureKey, HacParams, HacStatus, HcahpsItem } from '../../lib/types'
import { HAI_KEYS, eventsToCross, percentileOf, simulate, statusFor, type BaselineMeasure } from '../../lib/simulate'
import type { HacViewModel } from './viewModel'

interface Props {
  vm: HacViewModel
  params: HacParams
  nurse: HcahpsItem | undefined
  nursePeerValues: (number | null)[] | null
  nurseNationalValues: (number | null)[] | null
}

const STATUS_BG: Record<HacStatus, string> = {
  penalized: 'bg-critical/10 border-critical/40',
  near: 'bg-warning/10 border-warning/40',
  clear: 'bg-ok/10 border-ok/40',
  exempt: 'bg-surface-2 border-border',
  no_score: 'bg-surface-2 border-border',
}

function Slider({ id, label, value, min, max, step, onChange, display, disabled, hint }: {
  id: string; label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; display: string; disabled?: boolean; hint?: string
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[15px] font-semibold text-ink">{label}</label>
        <output htmlFor={id} className="tabular text-sm font-semibold text-ink">{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#112659]"
        aria-valuetext={display}
      />
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export default function WhatIfPanel({ vm, params, nurse, nursePeerValues, nurseNationalValues }: Props) {
  const base: BaselineMeasure[] = useMemo(
    () => vm.measures.map((m) => ({ key: m.key, value: m.value, predicted: m.predicted, observed: m.observed, zFixed: m.value == null ? m.z : null })),
    [vm],
  )
  const [prevented, setPrevented] = useState<Partial<Record<HacMeasureKey, number>>>({})
  const [psiDelta, setPsiDelta] = useState(0)
  const [nurseGain, setNurseGain] = useState(0)

  const sim0 = useMemo(() => simulate(base, params, { prevented: {}, psi90Delta: 0 }), [base, params])
  const sim = useMemo(() => simulate(base, params, { prevented, psi90Delta: psiDelta }), [base, params, prevented, psiDelta])

  // Anchor on the displayed (official) total; apply the simulated change on top of it.
  const baseTotal = vm.total ?? sim0.total
  const newTotal = baseTotal == null || sim.total == null || sim0.total == null ? null : baseTotal + (sim.total - sim0.total)
  const newGap = newTotal == null ? null : newTotal - params.cutoff
  const cushion = useMemo(() => {
    if (newGap == null || newGap > 0) return null
    const ev = HAI_KEYS.map((k) => eventsToCross({ ...base.find((b) => b.key === k)!, value: sim.values[k] }, sim.weights[k], newGap, params))
      .filter((e) => e.feasible && e.events != null)
      .map((e) => e.events as number)
    return ev.length ? Math.min(...ev) : null
  }, [base, sim, newGap, params])
  const untouched = psiDelta === 0 && Object.values(prevented).every((v) => !v)
  // With no changes, show the official status (it uses the CMS payment flag, not only the gap).
  // Maryland stays exempt whatever the simulated score: the waiver, not the score, removes the penalty
  const newStatus = untouched || vm.status === 'exempt' ? vm.status : statusFor(newGap, cushion, params.near_band)
  const changed = newStatus !== vm.status

  const psi = base.find((b) => b.key === 'psi90')
  const psiSd = params.measures.psi90.sd
  const psiStep = Math.max(0.0005, Math.round((psiSd / 20) * 10000) / 10000)
  const psiRange = Math.round(psiSd * 3 * 10000) / 10000

  const nurseVal = nurse?.value ?? null
  const nurseNew = nurseVal == null ? null : Math.min(100, nurseVal + nurseGain)
  const pPeer0 = nursePeerValues ? percentileOf(nurseVal, nursePeerValues) : null
  const pPeer1 = nurseGain === 0 ? pPeer0 : nursePeerValues ? percentileOf(nurseNew, nursePeerValues) : null
  const pNat0 = nurse?.percentile_national ?? (nurseNationalValues ? percentileOf(nurseVal, nurseNationalValues) : null)
  const pNat1 = nurseGain === 0 ? pNat0 : nurseNationalValues ? percentileOf(nurseNew, nurseNationalValues) : null

  const reset = () => {
    setPrevented({})
    setPsiDelta(0)
    setNurseGain(0)
  }

  const plainGap = (g: number | null) => (g == null ? 'N/A' : g > 0 ? `${fmt(g, 2)} above the line` : `${fmt(-g, 2)} below the line`)

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
          <span className="font-semibold text-ink">How to use this: </span>
          Move a slider to imagine preventing some infections. The result on the right updates right away and shows whether the hospital would move above or below the penalty line.
          Nothing is saved, and the math is the same as the rest of this site.
        </p>
        <button type="button" onClick={reset} className="no-print shrink-0 border border-[#112659] px-4 py-2 text-sm font-bold text-ink hover:bg-surface-2">Start over</button>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {HAI_KEYS.map((k) => {
            const b = base.find((x) => x.key === k)!
            const usable = b.value != null && b.predicted != null && b.predicted > 0
            const max = usable ? Math.max(0, Math.round(b.observed ?? Math.ceil((b.value as number) * (b.predicted as number)))) : 0
            const n = prevented[k] ?? 0
            return (
              <Slider
                key={k}
                id={`wi-${k}`}
                label={`Prevent ${lower(HAC_LABELS[k])}`}
                value={n}
                min={0}
                max={Math.max(max, 1)}
                step={1}
                disabled={!usable || max === 0}
                onChange={(v) => setPrevented((p) => ({ ...p, [k]: v }))}
                display={usable ? `${n} fewer` : 'No result'}
                hint={usable ? `This hospital had ${max} in the period. Rate vs expected becomes ${fmt(sim.values[k], 2)}.` : 'No rate or expected count reported for this hospital.'}
              />
            )
          })}
          <Slider
            id="wi-psi90"
            label="Change patient safety events"
            value={psiDelta}
            min={-psiRange}
            max={psiRange}
            step={psiStep}
            disabled={psi?.value == null}
            onChange={setPsiDelta}
            display={psi?.value == null ? 'No result' : psiDelta === 0 ? 'No change' : `${fmt(Math.abs(psiDelta), 3)} ${psiDelta < 0 ? 'lower' : 'higher'}`}
            hint={psi?.value == null ? 'Not reported for this hospital.' : `Slide left for fewer safety events. The combined rate becomes ${fmt(sim.values.psi90, 3)}.`}
          />
          <Slider
            id="wi-nurse"
            label="Improve nurse communication score"
            value={nurseGain}
            min={0}
            max={nurseVal == null ? 1 : Math.max(1, Math.min(15, 100 - nurseVal))}
            step={1}
            disabled={nurseVal == null}
            onChange={setNurseGain}
            display={nurseVal == null ? 'Not reported' : `+${nurseGain} points`}
            hint={nurseVal == null ? 'Not reported for this hospital.' : `Share of patients who said nurses always communicated well becomes ${fmt(nurseNew, 0)}%. This does not change the safety score.`}
          />
        </div>

        <div aria-live="polite" className={`border-2 p-5 motion-safe:transition-colors motion-safe:duration-500 ${STATUS_BG[newStatus]}`}>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Your result</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={newStatus} />
            {changed && <span className="text-sm font-semibold text-ink motion-safe:animate-pulse">was {lower(STATUS_LABEL[vm.status])}</span>}
          </div>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm text-muted">New safety score</dt>
              <dd className="tabular text-4xl font-light text-ink">{fmt(newTotal, 2)}</dd>
              <dd className="text-sm text-muted">Before: {fmt(baseTotal, 2)}. Penalty line: {fmt(params.cutoff, 2)}.</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Distance from the line</dt>
              <dd className={`text-xl font-semibold ${newGap != null && newGap > 0 ? 'text-critical' : 'text-ok'}`}>{plainGap(newGap)}</dd>
            </div>
            {cushion != null && (
              <div className="text-sm text-muted">With these changes, about {cushion} more infection{cushion === 1 ? '' : 's'} of the most sensitive type would push it back over the line.</div>
            )}
            <div className="border-t border-[#C9D2E3] pt-4">
              <dt className="text-sm text-muted">Nurse communication ranking</dt>
              <dd className="text-sm text-ink">
                Better than {pNat0 == null ? 'N/A' : `${Math.round(pNat0)}%`} of hospitals now, <strong>{(pNat1 ?? pNat0) == null ? 'N/A' : `${Math.round((pNat1 ?? pNat0) as number)}%`}</strong> after the change
                {pPeer0 != null && pPeer1 != null && <>. Among similar hospitals: {Math.round(pPeer0)}% now, <strong>{Math.round(pPeer1)}%</strong> after.</>}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <Note>
        <strong className="text-ink">This is an estimate.</strong> Other hospitals and the penalty line are held where they are today. A separate Medicare program (Value Based Purchasing)
        also uses patient survey results, but it scores them with its own thresholds, so this tool only shows how the hospital’s ranking would move.
      </Note>
      <Source>CareSignal calculation using the CMS FY2026 Hospital Acquired Condition rules and the CMS patient survey (HCAHPS)</Source>
    </div>
  )
}
