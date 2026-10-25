/** Shared copy for Methods / Data Quality. Mirrors the documented limitations of the project plan (§14). */
export const LIMITATIONS: { title: string; body: string }[] = [
  {
    title: 'CMS data lags 1–2+ years',
    body: 'CareSignal is a strategic radar, not real-time surveillance. The same engine could run on a hospital’s internal NHSN and incident data for monthly tracking.',
  },
  {
    title: 'Medicare fee-for-service only',
    body: 'HAC and HRRP cover Medicare FFS discharges. PSI measures are derived from claims, not chart review.',
  },
  {
    title: 'Patients-to-prevent is approximate',
    body: 'It holds peer performance and the cutoff constant. The real cutoff is recalculated every fiscal year.',
  },
  {
    title: 'VBP points are not reproduced',
    body: 'Achievement and improvement thresholds come from separate files, so the tool shows percentile positions instead of VBP points.',
  },
  {
    title: 'Small denominators make SIRs unstable',
    body: 'Many SIRs are suppressed or footnoted by CMS. The UI shows confidence intervals and suppression notes instead of hiding them.',
  },
  {
    title: 'Dollar exposure is an estimate',
    body: 'It uses 1% of total Medicare inpatient payments. The actual reduction applies to FFS base-operating DRG payments.',
  },
  {
    title: 'Nursing categories are informed judgment',
    body: 'Each measure’s category comes with a written rationale, and peer review of the mapping is welcome.',
  },
]

/** Link to a dataset's public landing page. PDC ids look like 'xxxx-xxxx'. */
export function datasetUrl(id: string, downloadUrl: string): string {
  return /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(id) ? `https://data.cms.gov/provider-data/dataset/${id}` : downloadUrl
}
