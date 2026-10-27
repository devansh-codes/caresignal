import type { Hospital } from '../../lib/types'
import { fmt, fmtUsd } from '../../lib/format'
import { BigStat } from './shared'

/** Step 1 headline numbers: score, penalty, distance from the line, money at risk. */
export default function StandingStats({ h }: { h: Hospital }) {
  const hac = h.hac
  if (!hac) return null
  const exempt = hac.status === 'exempt'
  const above = hac.gap > 0
  const exposure = hac.exposure_usd ?? (h.profile.medicare_payments != null ? h.profile.medicare_payments * 0.01 : null)
  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-[#C9D2E3] xl:[&>*:not(:first-child)]:pl-8">
      <BigStat
        caption="Safety score"
        value={fmt(hac.total, 2)}
        tone={exempt ? 'ink' : above ? 'critical' : hac.status === 'near' ? 'warning' : 'ok'}
        sub={<>Higher means more infections and safety problems than average. <span className="text-xs">(Total HAC Score {fmt(hac.total, 4)})</span></>}
      />
      <BigStat
        caption="Penalty line"
        value={fmt(hac.cutoff, 2)}
        sub={<>The worst 25% of hospitals score above this line. <span className="text-xs">(75th percentile cutoff {fmt(hac.cutoff, 4)})</span></>}
      />
      <BigStat
        caption={above ? 'Above the line by' : 'Below the line by'}
        value={fmt(Math.abs(hac.gap), 2)}
        tone={exempt ? 'ink' : above ? 'critical' : hac.status === 'near' ? 'warning' : 'ok'}
        sub={exempt ? 'Maryland hospitals are exempt, so no penalty applies.' : above ? 'Medicare takes 1% off this hospital’s payments for the year.' : 'No Medicare payment reduction this year.'}
      />
      <BigStat
        caption="Money at risk (estimate)"
        value={fmtUsd(exposure)}
        tone={exposure == null ? 'muted' : 'ink'}
        sub={exposure == null ? 'Medicare payment data not available for this hospital.' : 'About 1% of this hospital’s yearly Medicare inpatient payments. A rough guide, not an exact amount.'}
      />
    </div>
  )
}
