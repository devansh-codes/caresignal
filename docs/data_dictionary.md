# Data Dictionary

This dictionary describes the processed tables and the site JSON. The normative shapes are in `docs/CONTRACTS.md` and `web/src/lib/types.ts`; this file explains what each field means.

The same conventions apply everywhere:
- `ccn` is the 6-character CMS Certification Number, a string with leading zeros.
- Dates are ISO `YYYY-MM-DD`.
- A missing value is null, never 0.
- A `*_fn` column holds the CMS footnote code attached to the value beside it.

---

## Raw sources (`data/raw/`)

| File | CMS dataset | Content |
|---|---|---|
| `xubh-q36u.csv` | Hospital General Information | Facility list, type, ownership, emergency services, overall star rating |
| `77hc-ibv8.csv` | Healthcare Associated Infections – Hospital | Long format, `HAI_n_{SIR,NUMERATOR,ELIGCASES,DOPC,CILOWER,CIUPPER}` |
| `dgck-syfz.csv` | Patient survey (HCAHPS) – Hospital | Answer percents, linear means and star ratings by HCAHPS measure ID |
| `ynj2-r877.csv` | Complications and Deaths – Hospital | PSI and mortality measures with comparison to national |
| `muwa-iene.csv` | PSI-90 and components, six-digit estimate | Precise PSI rates |
| `yq43-i98g.csv` | HAC Reduction Program FY2026 | Official measure values, Winsorized z-scores, Total HAC Score and payment reduction (ground truth) |
| `9n3s-kdb3.csv` | Hospital Readmissions Reduction Program | Excess readmission ratios by condition |
| `ypbt-wvdk.csv` | HVBP Total Performance Score | Domain scores and TPS |
| `632h-zaca.csv` | Unplanned Hospital Visits – Hospital | Readmission and return-visit measures |
| `yv7e-xc69.csv` | Timely and Effective Care – Hospital | Process measures, including SEP-1 |
| `99ue-w85f.csv` / `84jm-wiui.csv` | HCAHPS National / State | Benchmarks |
| `cost_report.csv` | Hospital Provider Cost Report | Beds, intern and resident FTEs, rural vs urban |
| `medicare_inpatient.csv` | Medicare Inpatient Hospitals – by Provider | Medicare payments and discharges |
| `manifest.json` | — | Fetch metadata for each file: `modified`, URL, rows, SHA-256, HTTP status, fetch time |

HAI measure keys:

| HAI ID | Key | Measure |
|---|---|---|
| HAI_1 | `clabsi` | Central line-associated bloodstream infection |
| HAI_2 | `cauti` | Catheter-associated urinary tract infection |
| HAI_3 | `ssi_colon` | Surgical site infection, colon surgery |
| HAI_4 | `ssi_hyst` | Surgical site infection, abdominal hysterectomy |
| HAI_5 | `mrsa` | MRSA bacteremia |
| HAI_6 | `cdi` | *Clostridioides difficile* infection |

In those files, NUMERATOR is the observed count, ELIGCASES the predicted count, and DOPC the device days or patient days.

---

## Processed tables (`data/processed/`)

### `hospitals.parquet` (one row per facility in Hospital General Information)

Facility identity, from Hospital General Information:

| Field | Description |
|---|---|
| `ccn` | CMS Certification Number |
| `name`, `address`, `city`, `state`, `zip`, `county`, `phone` | Facility identity |
| `hospital_type` | CMS hospital type, for example Acute Care Hospitals or Critical Access Hospitals |
| `ownership` | CMS ownership category |
| `emergency_services` | Whether the hospital provides emergency services (bool) |
| `overall_rating`, `overall_rating_fn` | CMS overall star rating from 1 to 5, and its footnote |
| `census_region` | Census region derived from state; territories are grouped separately |

From the cost report:

| Field | Description |
|---|---|
| `beds` | Number of beds |
| `resident_fte` | Number of interns and residents (FTE) |
| `urban_rural` | `urban` or `rural`, from "Rural Versus Urban" |
| `cost_report_year` | Cost report year used for the match |

From Medicare Inpatient Hospitals – by Provider:

| Field | Description |
|---|---|
| `medicare_payments` | `Tot_Mdcr_Pymt_Amt`, total Medicare payment amount |
| `medicare_total_payments` | `Tot_Pymt_Amt`, total payment from all payers for Medicare stays |
| `medicare_discharges` | `Tot_Dschrgs` |

### `hai.parquet` (ccn × HAI key; most recent HAI period)
| Field | Description |
|---|---|
| `key`, `hai_id` | Measure key (see above) and CMS prefix |
| `sir`, `sir_fn` | Standardized infection ratio (observed ÷ predicted) and its footnote |
| `observed` | Observed infections (`_NUMERATOR`) |
| `predicted` | Predicted infections (`_ELIGCASES`) |
| `device_days` | Device days or patient days (`_DOPC`) |
| `ci_lower`, `ci_upper` | 95% confidence interval for the SIR |
| `compared_to_national` | CMS comparison category |
| `start_date`, `end_date` | Reporting period |

### `psi.parquet` (ccn × PSI measure)
| Field | Description |
|---|---|
| `measure_id`, `measure_name` | For example `PSI_03` (pressure ulcer) or `PSI_90` (composite) |
| `rate`, `rate_fn` | Six-digit estimate from `muwa-iene` |
| `score` | Rounded score from Complications and Deaths (`ynj2-r877`) |
| `compared_to_national`, `lower`, `higher`, `denominator` | From Complications and Deaths |
| `start_date`, `end_date`, `source` | Period and the dataset each value came from |

### `hcahps.parquet` (ccn × HCAHPS measure ID)
| Field | Description |
|---|---|
| `measure_id` | For example `H_COMP_1_A_P` (nurses "Always" communicated well) |
| `question`, `answer_desc` | CMS question and answer text |
| `answer_pct`, `answer_pct_fn` | Percentage of respondents giving that answer |
| `star_rating` | Star rating (for `*_STAR_RATING` rows) |
| `linear_mean` | Linear mean score (for `*_LINEAR_SCORE` rows) |
| `completed_surveys`, `response_rate` | Survey volume and response rate |
| `start_date`, `end_date` | Survey period |

### `hcahps_benchmarks.parquet`
| Field | Description |
|---|---|
| `level` | `NATION` or a two-letter state code |
| `measure_id`, `answer_pct` | Benchmark top-box (or other) percent |
| `start_date`, `end_date` | Period |

### `hrrp.parquet` (ccn × condition)
| Field | Description |
|---|---|
| `condition` | `AMI`, `CABG`, `COPD`, `HF`, `HIP-KNEE` or `PN` |
| `discharges` | Number of eligible discharges |
| `err` | Excess readmission ratio; above 1.0 means more readmissions than expected |
| `predicted_rate`, `expected_rate` | Risk-adjusted predicted and expected readmission rates |
| `readmissions` | Number of readmissions, kept as text because CMS publishes values such as `Too Few to Report` |
| `footnote`, `start_date`, `end_date` | Footnote and performance period |

### `vbp.parquet` (one row per CCN)
| Field | Description |
|---|---|
| `fiscal_year` | VBP program year |
| `clinical_w`, `engagement_w`, `safety_w`, `efficiency_w` | Weighted domain scores |
| `clinical_u`, `engagement_u`, `safety_u`, `efficiency_u` | Unweighted (normalized) domain scores |
| `tps` | Total Performance Score |

### `timely_care.parquet` (ccn × measure)
| Field | Description |
|---|---|
| `measure_id` | For example `SEP_1` (severe sepsis and septic shock management bundle) |
| `score` | Numeric score, or null when the value is not numeric |
| `score_text` | The original CMS text value |
| `sample`, `footnote`, `start_date`, `end_date` | Sample size, footnote and period |

### `unplanned_visits.parquet` (ccn × measure)
| Field | Description |
|---|---|
| `measure_id`, `measure_name` | Readmission or return-visit measure |
| `score`, `lower`, `higher` | Rate and interval |
| `denominator`, `compared_to_national` | Volume and CMS comparison |
| `footnote`, `start_date`, `end_date` | Footnote and period |

### `hac_rebuild.parquet` (one row per CCN in the FY2026 HAC file)

For each measure `m` in `psi90, clabsi, cauti, ssi, cdi, mrsa`:

| Field | Description |
|---|---|
| `{m}_value`, `{m}_value_fn` | Official PSI 90 composite value or SIR, and its footnote |
| `{m}_z_official`, `{m}_z_fn` | Official Winsorized z-score and its footnote |
| `{m}_winsorized` | Value clipped to the rebuilt 5th/95th-percentile bounds |
| `{m}_z_rebuilt` | Rebuilt z-score |

Hospital-level fields:

| Field | Description |
|---|---|
| `is_maryland` | Whether the hospital is in Maryland |
| `n_measures` | Number of measures with a result |
| `total_official`, `total_rebuilt`, `total_fn` | Official and rebuilt Total HAC Score |
| `payment_reduction_official`, `payment_reduction_rebuilt`, `payment_reduction_fn` | Payment-reduction flag (official vs rebuilt) |
| `psi90_start`, `psi90_end`, `hai_start`, `hai_end` | Performance periods |

### `hac_params.json`
| Field | Description |
|---|---|
| `fiscal_year` | HAC program year |
| `cutoff` | 75th-percentile Total HAC Score; above it means penalized |
| `cutoff_method` | How the cutoff was derived |
| `near_band` | Event threshold for "Near cutoff" (2 added infections) |
| `measures.{m}` | `winsor_low`, `winsor_high`, `mean`, `sd` and `n` for the measure, used by the pipeline, the Excel workbook and `simulate.ts` |

### `hospital_metrics.parquet` (one row per CCN; feeds the Excel Data sheet)

Identity and peer group:

| Field | Description |
|---|---|
| `peer_key`, `peer_label` | Peer group (see Peer key format) |
| `peer_fallback` | True when the group fell back to bed size plus teaching |
| `bed_band`, `teaching`, `urban_rural`, `region`, `beds` | Peer-group dimensions |

HAC result:

| Field | Description |
|---|---|
| `hac_total`, `hac_cutoff` | Official Total HAC Score and the cutoff |
| `hac_gap` | Total minus cutoff; above 0 means above the cutoff |
| `hac_status` | `penalized`, `near`, `clear` or `no_score` (see CONTRACTS.md) |
| `payment_reduction` | Official payment-reduction flag |
| `hac_percentile` | National percentile of the total; higher is worse |
| `{m}_value`, `{m}_z`, `{m}_predicted` | Measure value, official z-score and predicted infections (proxy) |

Patients-to-prevent:

| Field | Description |
|---|---|
| `ptp_{m}_events` | Infections to prevent in measure `m` alone to clear the cutoff; null if infeasible |
| `tipping_measure`, `tipping_events` | The cheapest feasible measure and its event count |
| `min_cushion_events` | For clear hospitals, the fewest added infections in one measure that would cross the cutoff |

Trajectory:

| Field | Description |
|---|---|
| `traj_total`, `traj_gap`, `traj_status` | Current-trajectory proxy score against the FY2026 distribution |

Patient experience and readmissions:

| Field | Description |
|---|---|
| `nurse_comm_top_box` | `H_COMP_1_A_P` |
| `nurse_comm_pctl_nat`, `nurse_comm_pctl_peer` | Percentile ranks; higher is better |
| `discharge_info_yes` | `H_COMP_6_Y_P` |
| `care_transition` | Care transition item, if published |
| `hcahps_star` | HCAHPS summary star rating |
| `err_*`, `n_err_above_1` | HRRP excess readmission ratios, and the count above 1.0 |

Financial and VBP:

| Field | Description |
|---|---|
| `exposure_usd` | About 1% of Medicare payments (estimate) |
| `vbp_tps` | VBP Total Performance Score |

### `peer_groups.parquet`
Peer group keys, labels, member counts and whether the fallback was used.

### `national.json` (processed)
National aggregates, copied into the site's `national.json`; see below.

### `dq_log.csv`
| Field | Description |
|---|---|
| `rule_id`, `dataset`, `description` | Validation rule |
| `severity` | `error` (stops the build), `warn` or `info` |
| `checked`, `failed`, `passed` | Record counts and outcome |

---

## Site JSON (`web/public/data/`)

| File | Content |
|---|---|
| `manifest.json` | Build time, git SHA, and for each source its title, role, CMS `modified` date, download URL, rows, reporting period, HTTP status, SHA-256 and fetch time |
| `index.json` | One compact entry per facility for search and the hospital directory: `ccn`, `name`, `city`, `state`, `type`, `hac` (official total), `status`, `gap`, `tip` (tipping measure and events), `peer` |
| `hospitals/{ccn}.json` | Everything on a hospital page; see the table below |
| `peers/{key}.json` | All member CCNs of a peer group with aligned value arrays for `hac_total`, the six HAC measure values, `nurse_comm`, `discharge_info`, `hcahps_star` and `err_hf` / `err_pn` / `err_ami` / `err_copd`, used for distribution charts |
| `national.json` | The HAC parameters (cutoff, bounds, mean, SD); counts by status; computed insights with source and period; the Total HAC histogram; nursing share of weighted HAC points; tipping-measure counts; the two-infection counts; breakdowns by peer group and state; the nurse communication vs HAC scatter with its Pearson r; national HCAHPS benchmarks |
| `accuracy.json` | HAC rebuild vs official: flag agreement, the share of z-scores within ±0.001 and the largest difference per measure, total-score agreement, official vs rebuilt cutoff, a list of mismatches and notes |
| `dq.json` | The validation rule log (same fields as `dq_log.csv`) and build time |
| `measures.json` | The measure dictionary (ID, label, program, nursing category, rationale, direction, source) and a dictionary of CMS footnote codes |

The blocks in `hospitals/{ccn}.json`:

| Block | Content |
|---|---|
| `profile` | Beds, resident FTE, Medicare payments and discharges, cost report year |
| `peer` | Peer key, label, size, whether the fallback was used, and the dimensions |
| `hac` | The official FY2026 result: `total`, `total_rebuilt`, `cutoff`, `gap`, `status`, `payment_reduction` and `percentile`. It also holds `measures[]` (value, official and rebuilt z, weight, contribution, Winsorization bounds, mean, SD, predicted and observed counts), `patients_to_prevent[]`, `tipping_measure`, `cushion_events[]` and `exposure_usd` |
| `trajectory` | The same scoring on current HAI and PSI data against FY2026 parameters (proxy) |
| `hai` | Current HAI rows with SIR, CI, observed and predicted counts, device days and footnotes |
| `psi` | PSI rows with nursing category |
| `hcahps` | Items with hospital value, peer median, state, national, and national and peer percentiles |
| `readmissions` | HRRP rows by condition |
| `vbp` | TPS, its percentile and the four domain scores |
| `sep1` | SEP-1 bundle compliance |

Every block includes `source` (a CMS dataset ID) and `period`.
