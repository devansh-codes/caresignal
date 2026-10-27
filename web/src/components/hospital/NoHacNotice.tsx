import type { Hospital } from '../../lib/types'
import { Panel } from './shared'

/** Friendly explanation for a missing safety score, so a blank never reads as "fine". */
export default function NoHacNotice({ h }: { h: Hospital }) {
  const t = (h.type || '').toLowerCase()
  const reason = t.includes('critical access')
    ? 'This is a Critical Access Hospital. These are small, often rural hospitals that Medicare pays in a different way, so they are not part of this penalty program.'
    : t.includes('children')
      ? 'This is a children’s hospital. Medicare pays children’s hospitals in a different way, so they are not part of this penalty program.'
      : /psychiatric|rehabilitation|long.term|veterans|department of defense/.test(t)
        ? 'This type of facility is not a general acute care hospital, so it is not part of this penalty program.'
        : 'Medicare did not publish a safety score for this hospital this year. Common reasons are that it is not part of the program, it is new, or it had too little data.'
  return (
    <Panel className="border-l-4 border-[#FECA71]">
      <h3 className="text-xl font-bold text-ink">This hospital does not have a safety score</h3>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">{reason}</p>
      <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted">That means the Medicare 1% safety penalty does not apply. You can still see infection, patient survey and readmission results in the tabs above.</p>
      <p className="mt-4 text-xs text-muted">Source: CMS Hospital Acquired Condition Reduction Program, FY2026, and CMS Hospital General Information</p>
    </Panel>
  )
}
