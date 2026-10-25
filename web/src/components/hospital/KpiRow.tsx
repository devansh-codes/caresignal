import { KpiTile } from '../ui'
import type { Hospital } from '../../lib/types'
import { HAC_EVENT_NOUN, HAC_LABELS, fmt, fmtOrdinal, fmtSigned, fmtUsd } from '../../lib/format'
import { sourceLine } from './helpers'

export default function KpiRow({ h }: { h: Hospital }) {
  const hac = h.hac
  const nurse = h.hcahps?.items.find((i) => i.id === 'H_COMP_1_A_P')
  const hacSrc = hac ? sourceLine(hac.source, 'HAC Reduction Program', hac.period.hai, `FY${hac.fiscal_year}`) : undefined

  let tip: { value: string; context: string; tone: 'critical' | 'warning' | 'ok' | 'neutral' } = {
    value: '—',
    context: 'No HAC score',
    tone: 'neutral',
  }
  const exempt = hac?.status === 'exempt'
  if (hac && exempt) {
    tip = { value: 'Not applicable', context: 'Maryland hospitals are waived from the HAC payment reduction, so there is no penalty line to clear.', tone: 'neutral' }
  } else if (hac) {
    if (hac.gap > 0) {
      const t = hac.tipping_measure ? hac.patients_to_prevent.find((p) => p.measure === hac.tipping_measure) : null
      if (t?.events != null) {
        const [one, many] = HAC_EVENT_NOUN[t.measure]
        tip = { value: `~${t.events} ${t.events === 1 ? one : many}`, context: `Fewest prevented infections that clear the cutoff (${HAC_LABELS[t.measure]}). Approximate.`, tone: 'warning' }
      } else tip = { value: 'No single measure', context: 'No one infection measure alone clears the cutoff; improvement is needed across measures.', tone: 'critical' }
    } else {
      const c = (hac.cushion_events ?? []).filter((p) => p.feasible && p.events != null).sort((a, b) => (a.events as number) - (b.events as number))[0]
      if (c) {
        const [one, many] = HAC_EVENT_NOUN[c.measure]
        tip = { value: `${c.events} more ${c.events === 1 ? one : many}`, context: `Cushion: added infections that would cross the cutoff. Approximate.`, tone: hac.status === 'near' ? 'warning' : 'ok' }
      } else tip = { value: 'Clear', context: 'No single infection measure would push this hospital over the cutoff.', tone: 'ok' }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiTile
        label="Total HAC Score"
        value={hac ? fmt(hac.total, 4) : '—'}
        tone={!hac || exempt ? 'neutral' : hac.gap > 0 ? 'critical' : hac.status === 'near' ? 'warning' : 'ok'}
        context={hac ? `${fmtSigned(hac.gap, 4)} vs cutoff ${fmt(hac.cutoff, 4)}` : 'Not scored in the HAC program'}
        info="Equal-weighted average of Winsorized z-scores across PSI 90 and five infection measures. Higher is worse. Hospitals above the 75th-percentile cutoff are penalized."
        source={hacSrc}
      />
      <KpiTile
        label="Payment reduction"
        value={exempt ? 'Exempt' : hac?.payment_reduction == null ? '—' : hac.payment_reduction ? '1% applied' : 'None'}
        tone={exempt ? 'neutral' : hac?.payment_reduction ? 'critical' : hac ? 'ok' : 'neutral'}
        context={exempt ? 'Exempt: Maryland All-Payer Model. HAC is scored, but no payment reduction applies.' : hac ? `Official FY${hac.fiscal_year} CMS determination` : 'Not applicable'}
        source={hacSrc}
      />
      <KpiTile
        label={hac && hac.gap <= 0 ? 'Cushion before penalty' : 'Patients to prevent'}
        value={tip.value}
        tone={tip.tone}
        context={tip.context}
        info="Converts the score gap into whole infections using the measure's SD and predicted infection count. Holds peers and the cutoff constant."
        source={hac ? 'CareSignal calculation from yq43-i98g + 77hc-ibv8 predicted counts' : undefined}
      />
      <KpiTile
        label="Est. 1% exposure"
        value={fmtUsd(hac?.exposure_usd ?? (h.profile.medicare_payments != null ? h.profile.medicare_payments * 0.01 : null))}
        context="Order-of-magnitude estimate: 1% of total Medicare inpatient payments"
        info="The actual HAC reduction applies to Medicare FFS base-operating DRG payments; this is an approximation."
        source="CMS Medicare Inpatient Hospitals – by Provider"
      />
      <KpiTile
        label="Nurse communication"
        value={nurse?.value != null ? `${fmt(nurse.value, 0)}%` : '—'}
        context={
          nurse?.value != null
            ? `${fmtOrdinal(nurse.percentile_national)} percentile nationally${nurse.percentile_peer != null ? ` · ${fmtOrdinal(nurse.percentile_peer)} in peers` : ''}`
            : 'Not reported by CMS'
        }
        info="HCAHPS 'Nurses always communicated well' top-box percentage (H_COMP_1_A_P)."
        source={h.hcahps ? sourceLine(h.hcahps.source, 'HCAHPS', h.hcahps.period) : undefined}
      />
    </div>
  )
}
