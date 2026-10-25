import { Card } from '../ui'
import type { Hospital } from '../../lib/types'

/** Explains a missing HAC score instead of leaving a blank that could read as "fine". */
export default function NoHacNotice({ h }: { h: Hospital }) {
  const t = (h.type || '').toLowerCase()
  const reason = t.includes('critical access')
    ? 'Critical Access Hospitals are paid on a cost basis and are not subsection (d) hospitals, so they are excluded from the HAC Reduction Program.'
    : t.includes('children')
      ? "Children's hospitals are not paid under the Medicare inpatient prospective payment system and are excluded from the HAC Reduction Program."
      : t.includes('psychiatric') || t.includes('rehabilitation') || t.includes('long-term') || t.includes('veterans') || t.includes('department of defense')
        ? 'This facility type is not a subsection (d) acute care hospital and is excluded from the HAC Reduction Program.'
        : 'CMS did not publish a FY2026 Total HAC Score for this facility. Common reasons: it is not a subsection (d) hospital, it is new, or it had too little data on every measure.'
  return (
    <Card title="No HAC Reduction Program score" className="border-dashed">
      <p className="text-sm text-ink">{reason}</p>
      <p className="mt-2 text-sm text-muted">The patient experience, infection and readmission results CMS does publish for this hospital are shown below.</p>
      <p className="mt-2 text-[11px] text-muted">Source: CMS HAC Reduction Program (yq43-i98g), FY2026. Facility type from Hospital General Information (xubh-q36u).</p>
    </Card>
  )
}
