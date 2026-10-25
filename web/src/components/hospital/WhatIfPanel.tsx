import { useMemo, useState } from 'react'
import { Button, Card, SourceNote, StatusPill } from '../ui'
import { HAC_LABELS, STATUS_LABEL, fmt, fmtOrdinal, fmtSigned } from '../../lib/format'
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
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
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
        className="mt-1 w-full accent-[rgb(var(--primary))]"
        aria-valuetext={display}
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
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
  const pPeer1 = nursePeerValues ? percentileOf(nurseNew, nursePeerValues) : null
  const pNat0 = nurse?.percentile_national ?? (nurseNationalValues ? percentileOf(nurseVal, nurseNationalValues) : null)
  const pNat1 = nurseNationalValues ? percentileOf(nurseNew, nurseNationalValues) : null

  const reset = () => {
    setPrevented({})
    setPsiDelta(0)
    setNurseGain(0)
  }

  return (
    <Card
      title="What-if simulator"
      subtitle={`Recomputes the score in your browser using ${vm.view === 'program' ? 'FY2026 program-year values' : 'current-trajectory values'} and the FY2026 Winsorization bounds, means, SDs and cutoff.`}
      action={<Button onClick={reset}>Reset</Button>}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HAI_KEYS.map((k) => {
            const b = base.find((x) => x.key === k)!
            const usable = b.value != null && b.predicted != null && b.predicted > 0
            const max = usable ? Math.max(0, Math.round(b.observed ?? Math.ceil((b.value as number) * (b.predicted as number)))) : 0
            const n = prevented[k] ?? 0
            return (
              <Slider
                key={k}
                id={`wi-${k}`}
                label={`Prevent ${HAC_LABELS[k]}`}
                value={n}
                min={0}
                max={Math.max(max, 1)}
                step={1}
                disabled={!usable || max === 0}
                onChange={(v) => setPrevented((p) => ({ ...p, [k]: v }))}
                display={usable ? `${n ? `−${n}` : '0'} → SIR ${fmt(sim.values[k], 3)}` : 'No result'}
                hint={usable ? `Up to ${max} observed · predicted ${fmt(b.predicted, 1)}` : 'No SIR or predicted count for this hospital'}
              />
            )
          })}
          <Slider
            id="wi-psi90"
            label="Change PSI 90 composite"
            value={psiDelta}
            min={-psiRange}
            max={psiRange}
            step={psiStep}
            disabled={psi?.value == null}
            onChange={setPsiDelta}
            display={psi?.value == null ? 'No result' : `${fmtSigned(psiDelta, 3)} → ${fmt(sim.values.psi90, 3)}`}
            hint="Negative = fewer patient-safety events (±3 SD range)"
          />
          <Slider
            id="wi-nurse"
            label="Nurse communication top-box"
            value={nurseGain}
            min={0}
            max={nurseVal == null ? 1 : Math.max(1, Math.min(15, 100 - nurseVal))}
            step={1}
            disabled={nurseVal == null}
            onChange={setNurseGain}
            display={nurseVal == null ? 'Not reported' : `+${nurseGain} pts → ${fmt(nurseNew, 0)}%`}
            hint="HCAHPS H_COMP_1 'Always' percentage; percentile shift only"
          />
        </div>

        <div aria-live="polite" className={`rounded-card border p-4 motion-safe:transition-colors motion-safe:duration-500 ${STATUS_BG[newStatus]}`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Simulated result</h3>
          <div className="mt-2 flex items-center gap-2">
            <StatusPill status={newStatus} />
            {changed && (
              <span className="text-xs font-medium text-ink motion-safe:animate-pulse">
                changed from {STATUS_LABEL[vm.status]}
              </span>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-1 grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted">Total HAC Score</dt>
              <dd className="tabular text-xl font-semibold text-ink">{fmt(newTotal, 4)}</dd>
              <dd className="tabular text-xs text-muted">was {fmt(baseTotal, 4)}</dd>
            </div>
            <div>
              <dt className="text-muted">Gap to cutoff</dt>
              <dd className={`tabular text-xl font-semibold ${newGap != null && newGap > 0 ? 'text-critical' : 'text-ok'}`}>{fmtSigned(newGap, 4)}</dd>
              <dd className="tabular text-xs text-muted">cutoff {fmt(params.cutoff, 4)}</dd>
            </div>
            {cushion != null && (
              <div className="col-span-2 text-xs text-muted">Cushion after changes: {cushion} added infection{cushion === 1 ? '' : 's'} in the most sensitive measure would cross the cutoff.</div>
            )}
            <div className="col-span-2 border-t border-border pt-3">
              <dt className="text-muted">Nurse communication percentile</dt>
              <dd className="tabular text-ink">
                National {fmtOrdinal(pNat0)} → <strong>{fmtOrdinal(pNat1 ?? pNat0)}</strong>
                {pPeer0 != null && (
                  <>
                    {' · '}Peers {fmtOrdinal(pPeer0)} → <strong>{fmtOrdinal(pPeer1)}</strong>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
        <strong className="font-semibold text-ink">Approximate.</strong> Peer performance and the cutoff are held constant. SIR′ = SIR − prevented ÷ predicted. The VBP
        Patient Experience domain uses achievement and improvement thresholds from separate CMS files, so this tool shows <em>percentile</em> movement only and does
        <strong className="font-semibold"> not</strong> reproduce VBP points. National percentile uses HAC-scored hospitals.
      </p>
      <SourceNote>Mirrors pipeline/hac_core.py · FY2026 parameters from CMS yq43-i98g · HCAHPS dgck-syfz</SourceNote>
    </Card>
  )
}
