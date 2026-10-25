/**
 * Site data contract. These types describe every JSON file under web/public/data/.
 * The Python exporter (pipeline/export_site.py) MUST emit exactly these shapes; see docs/CONTRACTS.md.
 * Conventions: CCN is always a 6-char string; dates are ISO 'YYYY-MM-DD'; missing values are null
 * (never 0, never "Not Available"); every block carries `source` (CMS dataset id) and `period`.
 */

export type Category = 'nursing' | 'shared' | 'other'
/** 'exempt' = scored but not subject to the payment reduction (Maryland All-Payer Model waiver, footnote a). */
export type HacStatus = 'penalized' | 'near' | 'clear' | 'exempt' | 'no_score'
export type HacMeasureKey = 'psi90' | 'clabsi' | 'cauti' | 'ssi' | 'cdi' | 'mrsa'
export type HaiKey = 'clabsi' | 'cauti' | 'ssi_colon' | 'ssi_hyst' | 'mrsa' | 'cdi'

export interface Period {
  start: string | null
  end: string | null
}

/** manifest.json */
export interface SourceEntry {
  id: string // CMS dataset id, e.g. 'yq43-i98g', or 'cost_report_2023'
  title: string
  role: string // what CareSignal uses it for
  modified: string | null // CMS 'modified' date
  download_url: string
  rows: number
  period: Period | null
  http_status: number
  sha256: string
  fetched_at: string
}
export interface Manifest {
  built_at: string
  git_sha: string | null
  sources: SourceEntry[]
}

/** index.json — one entry per facility in Hospital General Information */
export interface IndexEntry {
  ccn: string
  name: string
  city: string
  state: string
  type: string
  hac: number | null // official FY Total HAC Score
  status: HacStatus
  gap: number | null // total - cutoff
  tip: { measure: HacMeasureKey; events: number } | null
  peer: string | null // peer group key
}

/** One measure inside a hospital's HAC breakdown */
export interface HacMeasure {
  key: HacMeasureKey
  label: string
  category: Category
  value: number | null // official PSI 90 composite or SIR
  value_footnote: string | null
  z_official: number | null
  z_rebuilt: number | null
  weight: number // 0 if no result
  contribution: number | null // z * weight
  winsor_low: number
  winsor_high: number
  mean: number // mean of winsorized values
  sd: number // SD of winsorized values (population SD)
  predicted: number | null // predicted infections (proxy from current HAI file; HAI only)
  observed: number | null
}

export interface PatientsToPrevent {
  measure: HacMeasureKey
  events: number | null // whole infections to prevent (ceil); null if infeasible
  delta_sir: number | null
  feasible: boolean
  reason: string | null // e.g. 'Already clear', 'Winsorization floor reached', 'No predicted count'
}

export interface HacBlock {
  fiscal_year: number
  source: string // 'yq43-i98g'
  period: { psi90: Period; hai: Period }
  total: number // official Total HAC Score
  total_rebuilt: number | null
  cutoff: number
  gap: number // total - cutoff (>0 = above cutoff)
  status: HacStatus
  payment_reduction: boolean | null // official flag
  percentile: number // 0-100 national percentile of total (higher = worse)
  measures: HacMeasure[]
  patients_to_prevent: PatientsToPrevent[]
  tipping_measure: HacMeasureKey | null
  cushion_events: PatientsToPrevent[] | null // when clear: added events that would push over cutoff
  exposure_usd: number | null // ~1% of Medicare inpatient payments (estimate)
}

export interface TrajectoryBlock {
  source: string // '77hc-ibv8'
  period: Period
  label: string // 'Current trajectory (proxy, FY2026 distribution)'
  measures: { key: HacMeasureKey; value: number | null; z: number | null; observed: number | null; predicted: number | null }[]
  total: number | null
  gap: number | null
  status: HacStatus
  patients_to_prevent: PatientsToPrevent[]
  tipping_measure: HacMeasureKey | null
}

export interface HaiRow {
  key: HaiKey
  label: string
  category: Category
  sir: number | null
  ci_lower: number | null
  ci_upper: number | null
  observed: number | null
  predicted: number | null
  device_days: number | null
  compared_to_national: string | null
  footnote: string | null
}

export interface PsiRow {
  id: string // 'PSI_03'
  label: string
  category: Category
  rate: number | null
  compared_to_national: string | null
  footnote: string | null
}

export interface HcahpsItem {
  id: string // e.g. 'H_COMP_1_A_P'
  label: string
  category: Category
  value: number | null // top-box %
  peer_median: number | null
  state: number | null
  national: number | null
  percentile_national: number | null // 0-100, higher = better
  percentile_peer: number | null
  footnote: string | null
}

export interface ReadmissionRow {
  condition: string // 'HF'
  label: string
  err: number | null
  discharges: number | null
  readmissions: string | null // CMS reports '<11' etc. as text
  predicted_rate: number | null
  expected_rate: number | null
  footnote: string | null
}

export interface Peer {
  key: string
  label: string
  n: number
  fallback: boolean
  bed_band: string | null
  teaching: 'none' | 'minor' | 'major' | null
  urban_rural: 'urban' | 'rural' | null
  region: string | null
}

/** hospitals/{ccn}.json */
export interface Hospital {
  ccn: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  county: string
  type: string
  ownership: string
  emergency: boolean | null
  overall_rating: number | null
  peer: Peer | null
  profile: {
    beds: number | null
    resident_fte: number | null
    medicare_payments: number | null
    medicare_discharges: number | null
    cost_report_year: number | null
  }
  hac: HacBlock | null
  trajectory: TrajectoryBlock | null
  hai: { source: string; period: Period; rows: HaiRow[] } | null
  psi: { source: string; period: Period; rows: PsiRow[] } | null
  hcahps: {
    source: string
    period: Period
    surveys: number | null
    response_rate: number | null
    star: number | null
    items: HcahpsItem[]
  } | null
  readmissions: { source: string; period: Period; rows: ReadmissionRow[] } | null
  vbp: {
    source: string
    fiscal_year: number
    tps: number | null
    tps_percentile: number | null
    domains: { clinical: number | null; engagement: number | null; safety: number | null; efficiency: number | null }
  } | null
  sep1: { source: string; period: Period; score: number | null; footnote: string | null } | null
}

/** peers/{key}.json — values of every hospital in the peer group, for distribution charts */
export interface PeerFile {
  key: string
  label: string
  n: number
  hospitals: string[] // ccns
  values: Record<string, (number | null)[]> // metric id -> values aligned with `hospitals`
}

/** national.json */
export interface HacParams {
  fiscal_year: number
  cutoff: number
  near_band: number // clear hospitals within near_band added infections of the cutoff count as 'near'
  measures: Record<HacMeasureKey, { winsor_low: number; winsor_high: number; mean: number; sd: number; n: number }>
}
export interface Insight {
  id: string
  title: string
  value: string // formatted headline value, e.g. '754 (24.9%)'
  detail: string
  source: string
  period: string
}
export interface National {
  built_at: string
  hac_params: HacParams
  counts: {
    facilities: number
    hac_scored: number // has a published Total HAC Score (includes Maryland)
    penalized: number // official payment reduction = Yes, with a published score
    near: number
    clear: number
    exempt: number // Maryland: scored, waived from the payment reduction
    official_flagged: number // every official Yes flag, including any without a published score
    official_determinations: number // hospitals with a Yes/No payment determination
  }
  /** every peer group (including ones with no HAC-scored members), for labels and filters */
  peer_groups: { key: string; label: string; n: number }[]
  insights: Insight[]
  hac_histogram: { bins: number[]; counts: number[] } // bins = left edges, plus final right edge
  nursing_share: { category: Category; points: number; share: number }[]
  tipping_counts: { measure: HacMeasureKey; count: number }[]
  within_two: { penalized_clear_with_le2: number; clear_cross_with_le2: number }
  by_peer: { key: string; label: string; n: number; penalized: number; pct: number; median_hac: number | null }[]
  by_state: { state: string; n: number; penalized: number; pct: number }[]
  scatter_nurse_comm_vs_hac: { ccn: string; x: number; y: number }[]
  correlation: { r: number; n: number; method: 'pearson' } | null
  hcahps_national: Record<string, number | null>
}

/** accuracy.json — HAC rebuild vs official file */
export interface Accuracy {
  fiscal_year: number
  source: string
  n_hospitals: number
  n_scored: number
  flag_agreement: number // 0-1
  z_within_tol: Record<HacMeasureKey, number> // share within ±0.001
  total_within_tol: number
  max_abs_z_diff: Record<HacMeasureKey, number>
  cutoff_official_inferred: number
  cutoff_rebuilt: number
  mismatches: { ccn: string; name: string; field: string; official: number | string | null; rebuilt: number | string | null }[]
  notes: string[]
}

/** dq.json — validation rule log */
export interface DqRule {
  rule_id: string
  dataset: string
  description: string
  severity: 'error' | 'warn' | 'info'
  checked: number
  failed: number
  passed: boolean
}
export interface Dq {
  built_at: string
  rules: DqRule[]
}

/** measures.json — measure dictionary + nursing map + footnote dictionary */
export interface MeasureDef {
  id: string
  label: string
  program: string
  category: Category
  rationale: string
  direction: 'lower_better' | 'higher_better'
  source: string
}
export interface Measures {
  measures: MeasureDef[]
  footnotes: Record<string, string>
}
