# CareSignal — Build Contracts

This file is the shared interface between pipeline stages and the web app. If you change a shape, update this file and `web/src/lib/types.ts` together.

## Conventions
- CCN is a 6-character string with leading zeros. Never cast it to an integer.
- Column names are `snake_case`. Dates are ISO `YYYY-MM-DD` (CMS publishes `MM/DD/YYYY`).
- A missing value is `null`/`NaN`, never `0` and never `"Not Available"`. Footnote codes are kept as strings in `*_fn` columns.
- Every module runs as `python -m pipeline.<name>` from the repo root using `.venv/bin/python`.
- Paths: raw files go in `data/raw/{dataset_id}.csv`; processed tables go in `data/processed/*.parquet`; site JSON goes in `web/public/data/`.

## Pipeline order (`make data`)
`fetch → validate → transform → hac_rebuild → metrics → export_site → export_excel`

| Stage | Module | Reads | Writes |
|---|---|---|---|
| fetch | `pipeline/fetch.py` | `config/datasets.yaml` | `data/raw/*.csv`, `data/raw/manifest.json`, `data/snapshots/YYYY-MM-DD/manifest.json` |
| validate | `pipeline/validate.py` | raw | `data/processed/dq_log.csv`, `web/public/data/dq.json` (exits non-zero on any `error` rule failure) |
| transform | `pipeline/transform.py` + `pipeline/sql/*.sql` (DuckDB) | raw | the processed tables listed below |
| hac_rebuild | `pipeline/hac_core.py` (pure math) + `pipeline/hac_rebuild.py` | `data/raw/yq43-i98g.csv` | `data/processed/hac_rebuild.parquet`, `data/processed/hac_params.json`, `web/public/data/accuracy.json` |
| metrics | `pipeline/metrics.py` | processed + hac outputs + `config/measure_map.yaml` + `config/peer_rules.yaml` | `data/processed/hospital_metrics.parquet`, `data/processed/national.json`, `data/processed/peer_groups.parquet` |
| export_site | `pipeline/export_site.py` | everything above | `web/public/data/{index,national,manifest,measures}.json`, `hospitals/{ccn}.json`, `peers/{key}.json`, `web/public/downloads/*.csv` |
| export_excel | `pipeline/export_excel.py` | processed | `web/public/downloads/CareSignal_Workbook.xlsx` |

## Raw dataset IDs
PDC datasets (fetched as metastore → `distribution[0].downloadURL`):
- `xubh-q36u` general info
- `77hc-ibv8` HAI
- `dgck-syfz` HCAHPS
- `ynj2-r877` complications/PSI
- `muwa-iene` PSI six-digit
- `yq43-i98g` HAC FY2026
- `9n3s-kdb3` HRRP
- `ypbt-wvdk` VBP TPS
- `632h-zaca` unplanned visits
- `yv7e-xc69` timely and effective care
- `99ue-w85f` HCAHPS national
- `84jm-wiui` HCAHPS state

data.cms.gov datasets (found through `https://data.cms.gov/data.json` by title; take the newest year's CSV distribution):
- `cost_report` — "Hospital Provider Cost Report". The newest CSV is currently 2024, but 2023 is used for completeness unless coverage of 2024 is at least 90% of 2023's. The file is saved as `cost_report.csv`.
- `medicare_inpatient` — "Medicare Inpatient Hospitals - by Provider", newest year. The file is saved as `medicare_inpatient.csv`.

HAI measure IDs map as follows (`HAI_n_{SIR,NUMERATOR,ELIGCASES,DOPC,CILOWER,CIUPPER}`):

| Key | HAI ID |
|---|---|
| clabsi | HAI_1 |
| cauti | HAI_2 |
| ssi_colon | HAI_3 |
| ssi_hyst | HAI_4 |
| mrsa | HAI_5 |
| cdi | HAI_6 |

NUMERATOR is the observed count, ELIGCASES the predicted count, and DOPC device or patient days.

## Processed tables (owner: transform)
| Table | Grain | Columns |
|---|---|---|
| `hospitals.parquet` | 1 row per CCN in `xubh-q36u` | `ccn, name, address, city, state, zip, county, phone, hospital_type, ownership, emergency_services(bool), overall_rating(int\|null), overall_rating_fn, census_region, beds, resident_fte, urban_rural('urban'\|'rural'\|null), cost_report_year, medicare_payments(float, Tot_Mdcr_Pymt_Amt), medicare_total_payments(Tot_Pymt_Amt), medicare_discharges` |
| `hai.parquet` | ccn × hai key | `ccn, key, hai_id, sir, sir_fn, observed, predicted, device_days, ci_lower, ci_upper, compared_to_national, start_date, end_date` |
| `psi.parquet` | ccn × measure_id | `ccn, measure_id, measure_name, rate (six-digit file), rate_fn, score (C&D file), compared_to_national, lower, higher, denominator, start_date, end_date, source` |
| `hcahps.parquet` | ccn × hcahps_measure_id | `ccn, measure_id, question, answer_desc, answer_pct, answer_pct_fn, star_rating, linear_mean, completed_surveys, response_rate, start_date, end_date` |
| `hcahps_benchmarks.parquet` | level × measure_id | `level ('NATION' or state code), measure_id, answer_pct, start_date, end_date` |
| `hrrp.parquet` | ccn × condition | `ccn, condition (AMI\|CABG\|COPD\|HF\|HIP-KNEE\|PN), measure_name, discharges, err, predicted_rate, expected_rate, readmissions(text), footnote, start_date, end_date` |
| `vbp.parquet` | ccn | `ccn, fiscal_year, clinical_w, engagement_w, safety_w, efficiency_w, clinical_u, engagement_u, safety_u, efficiency_u, tps` |
| `timely_care.parquet` | ccn × measure_id | `ccn, condition, measure_id, measure_name, score(float\|null), score_text, sample, footnote, start_date, end_date` (SEP-1 = `SEP_1`) |
| `unplanned_visits.parquet` | ccn × measure_id | `ccn, measure_id, measure_name, compared_to_national, denominator, score, lower, higher, footnote, start_date, end_date` |

## HAC outputs (owner: hac_rebuild)
`hac_rebuild.parquet` has one row per CCN in the HAC file:
- Identity and flags: `ccn, name, state, is_maryland, fiscal_year`
- Per measure, for each `m` in `psi90, clabsi, cauti, ssi, cdi, mrsa`: `{m}_value, {m}_value_fn, {m}_z_official, {m}_z_fn, {m}_z_rebuilt, {m}_winsorized`
- Measure count: `n_measures`
- Scores: `total_official, total_rebuilt, total_fn`
- Payment reduction: `payment_reduction_official (bool|null), payment_reduction_fn, payment_reduction_rebuilt (bool|null)`
- Periods: `psi90_start, psi90_end, hai_start, hai_end`

`hac_params.json`:
```json
{"fiscal_year": 2026, "cutoff": 0.xxxx, "cutoff_method": "...", "near_band": 2,
 "measures": {"cauti": {"winsor_low":..,"winsor_high":..,"mean":..,"sd":..,"n":..}, ...}}
```
`pipeline/hac_core.py` exposes pure functions: `winsor_bounds(values)`, `winsorize(v, lo, hi)`, `zscore(w, mean, sd)`, `total_score(z_by_measure: dict) -> (total, weights)`, `required_value_change(...)`. Metrics imports these, and `web/src/lib/simulate.ts` mirrors them.

## Metrics outputs (owner: metrics)
`hospital_metrics.parquet` has one row per CCN in `hospitals.parquet`. It is the flat table the Excel Data sheet uses:
- Identity and peer group: `ccn, name, city, state, hospital_type, peer_key, peer_label, peer_fallback, bed_band, teaching, urban_rural, region, beds`
- HAC result: `hac_total, hac_cutoff, hac_gap, hac_status, payment_reduction, hac_percentile`
- HAC measure values, z-scores and predicted counts (`m` in `psi90, clabsi, cauti, ssi, cdi, mrsa`): `{m}_value, {m}_z, {m}_predicted`
- Patients-to-prevent: `ptp_{m}_events (Int|null), tipping_measure, tipping_events, min_cushion_events`
- Trajectory: `traj_total, traj_gap, traj_status`
- HCAHPS: `nurse_comm_top_box (H_COMP_1_A_P), nurse_comm_pctl_nat, nurse_comm_pctl_peer, discharge_info_yes (H_COMP_6_Y_P), care_transition (H_COMP_7 if present, else null), hcahps_star`
- Readmissions: `err_ami, err_hf, err_pn, err_copd, err_cabg, err_hip_knee, n_err_above_1`
- Exposure and VBP: `exposure_usd, vbp_tps`

### Status rules
- `no_score`: the hospital has no published Total HAC Score.
- `exempt`: a Maryland hospital (`is_maryland`; official flag `N/A`, footnote `a`). It is scored but waived from the payment reduction under the Maryland All-Payer Model. Exempt hospitals are left out of every penalty rate.
- `penalized`: the official `payment_reduction` flag is Yes. A suppressed flag outside Maryland falls back to gap > 0, but the FY2026 file has no such case.
- `near`: not penalized, and the smallest cushion across the HAI measures is ≤ `near_band` (2) added infections.
- `clear`: every other case.

`national.json.counts` also carries `exempt`, `official_flagged` (every official Yes, including CCN 440218, which has no published score) and `official_determinations`. `national.json.peer_groups` lists every peer key with its label.

### Peer key format
`{bed}-{teach}-{loc}-{region}`, for example `b100_299-minor-urban-south`. The fallback key is `{bed}-{teach}`.
- Bed bands: `b0_99`, `b100_299`, `b300_499`, `b500p`
- Teaching (ratio of resident FTE to beds): `none` when 0, `minor` above 0 and below 0.25, `major` at 0.25 or above
- Regions: `northeast`, `midwest`, `south`, `west`, `territory`

A group needs at least 15 hospitals that have a HAC score; otherwise the hospital uses the fallback key. A hospital with no cost-report match gets `peer_key = null`.

## Site JSON (owner: export_site)
`web/src/lib/types.ts` is the normative schema for every site JSON file. The peer metric ids in `peers/{key}.json` `values` are:
- `hac_total`
- `psi90_value`, `clabsi_value`, `cauti_value`, `ssi_value`, `cdi_value`, `mrsa_value`
- `nurse_comm`, `discharge_info`, `hcahps_star`
- `err_hf`, `err_pn`, `err_ami`, `err_copd`

## Ownership
Agents only edit files they own. If something you need is missing from another stage, read the shapes here and code against them.

| Agent | Owns |
|---|---|
| ingest | `pipeline/fetch.py`, `pipeline/validate.py`, `config/datasets.yaml`, `tests/test_data_contracts.py`, `tests/test_fetch.py` |
| transform | `pipeline/transform.py`, `pipeline/sql/`, `pipeline/common.py`, `tests/test_transform.py` |
| hac | `pipeline/hac_core.py`, `pipeline/hac_rebuild.py`, `tests/test_hac_rebuild.py`, `tests/test_hac_core.py` |
| metrics | `pipeline/metrics.py`, `pipeline/export_site.py`, `config/measure_map.yaml`, `config/peer_rules.yaml`, `tests/test_patients_to_prevent.py`, `tests/test_metrics.py`, `tests/test_export_site.py` |
| excel | `pipeline/export_excel.py`, `tests/test_excel.py`, `scripts/recalc_check.py` |
| fe-foundation | `web/src/components/layout/`, `web/src/components/search/`, `web/src/pages/{Home,Explore,NotFound}.tsx` |
| fe-hospital | `web/src/pages/Hospital.tsx`, `web/src/components/hospital/`, `web/src/lib/simulate.ts`, `web/src/lib/simulate.test.ts` |
| fe-analytics | `web/src/pages/{Insights,Methods,DataQuality,Downloads}.tsx`, `web/src/components/insights/` |
| devops-docs | `Makefile`, `.github/`, `README.md`, `LICENSE`, `.gitignore`, `docs/*.md` (except this file), `scripts/size_guard.sh`, `tests/fixtures/` |

Shared and frozen (ask the orchestrator to change): `web/src/lib/{types,data,format}.ts`, `web/src/components/ui/`, `web/src/components/charts/Chart.tsx`, `web/src/App.tsx`, `package.json`, `requirements.txt`.
