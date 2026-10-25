# CareSignal

**How close is your hospital to a Medicare quality penalty, and how many patients would change that?**

CareSignal is a nursing-sensitive quality and CMS penalty radar for every U.S. hospital. It is built only on public CMS data and refreshed weekly.

[![Live site](https://img.shields.io/badge/live-devansh--codes.github.io%2Fcaresignal-0B6E8A)](https://devansh-codes.github.io/caresignal/)
[![Pipeline & Deploy](https://github.com/devansh-codes/caresignal/actions/workflows/pipeline-and-deploy.yml/badge.svg)](https://github.com/devansh-codes/caresignal/actions/workflows/pipeline-and-deploy.yml)
[![CI](https://github.com/devansh-codes/caresignal/actions/workflows/ci.yml/badge.svg)](https://github.com/devansh-codes/caresignal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Live:** https://devansh-codes.github.io/caresignal/

<!-- SCREENSHOT: docs/screenshots/hospital.png -->

---

## The problem

Medicare cuts payments by 1% for hospitals in the worst-performing quartile of the Hospital-Acquired Condition (HAC) Reduction Program. Several of the measures behind that score are outcomes nursing directly influences: CAUTI, CLABSI, pressure injuries and falls with hip fracture. The data is public, but CMS spreads it across many files with different formats, footnotes and reporting periods. It never tells a nurse leader how many patient harms stand between their hospital and the penalty line.

## What it does

- **Hospital search:** search by name, city or CCN across every facility in CMS Hospital General Information.
- **Penalty proximity:** shows the Total HAC Score against the 75th-percentile cutoff, with each measure's weighted contribution as a waterfall.
- **Patients-to-prevent:** turns z-score gaps into whole infections, for example "about N fewer CAUTIs clears the cutoff". It highlights the cheapest *tipping measure*.
- **Nursing lens:** tags every measure *Nursing-driven*, *Shared* or *Other*, with a written rationale.
- **Peer benchmark:** compares each hospital with peers grouped by transparent rules: bed size, teaching intensity, urban/rural and Census region.
- **What-if simulator:** in-browser sliders recompute the HAC position using the same math as the Python pipeline.
- **Patient experience and readmissions:** shows HCAHPS nurse communication and discharge information against peer, state and nation, plus HRRP excess readmission ratios.
- **National insights:** findings computed across all scored hospitals.
- **1-page brief:** a print-optimized layout you can save as PDF.
- **Excel workbook:** a live, formula-driven workbook with a hospital selector and scenario inputs.
- **Data quality page:** source freshness, every validation rule with counts, and the HAC rebuild match rate against the official CMS file.

## How it works

```
GitHub Actions (weekly cron + on push + manual)
  fetch.py        CMS metastore → downloadURL → raw CSVs + manifest (modified dates, sha256, HTTP status)
  validate.py     schema, CCN format, footnotes, N/A handling, ranges → dq_log.csv
  transform.py    DuckDB SQL → tidy processed tables
  hac_rebuild.py  winsorize → z-score → equal weights → Total HAC → compare to official FY2026 file
  metrics.py      patients-to-prevent, peer groups, percentiles, national insights
  export_*.py     per-hospital JSON shards, national JSON, Excel workbook, CSV downloads
  pytest          methodology + data-contract tests (any failure = no deploy, previous site stays live)
  vite build      → GitHub Pages
        │
        ▼
Static React app (Vite + TypeScript + ECharts + Tailwind) reading precomputed JSON
```

There are no servers, API keys or runtime costs. Every number on the site traces back to a CMS dataset ID and reporting period.

## Key national findings

<!-- FINDINGS:START -->
_Computed by the pipeline from public CMS files (build 2026-10-25). Each finding lists the source dataset and its reporting period._

- **2,917** of 5,419 facilities have a FY2026 Total HAC Score; cutoff = **0.37955** (`yq43-i98g`).
- **Hospitals receiving the FY2026 HAC payment reduction: 719 (23.9%).** 719 of 3,012 hospitals with a payment determination are flagged for the 1% reduction; 718 of them have a published Total HAC Score (CCN 440218 is flagged without a published score); 2 scored, flagged hospitals are absent from Hospital General Information, so CareSignal profiles 716 penalized hospitals. 43 Maryland hospitals are scored but waived. Cutoff: Total HAC Score above 0.37955.  
  <sub>Source: `yq43-i98g` · FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31</sub>
- **Share of penalized hospitals' adverse HAC points from nursing-driven measures: 27.0%.** Among penalized hospitals, 27.0% of above-average weighted z-score points come from CLABSI and CAUTI (nursing-driven), 55.7% from shared measures and 17.3% from SSI. PSI 90 is counted as shared because its nursing-sensitive components (PSI 03, PSI 08) cannot be split out of the published composite.  
  <sub>Source: `yq43-i98g` · FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31</sub>
- **Penalized hospitals within 2 infections of clearing the cutoff: 404 of 716.** 404 penalized hospitals would fall to or below the cutoff with 2 or fewer prevented infections in a single measure, holding peers and the cutoff constant. Predicted counts come from the current HAI file (proxy).  
  <sub>Source: `yq43-i98g + 77hc-ibv8` · FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31; predicted counts 2024-10-01 to 2025-09-30</sub>
- **Clear hospitals within 2 infections of crossing the cutoff: 795.** 795 hospitals below the cutoff would cross it with 2 or fewer additional infections in one measure.  
  <sub>Source: `yq43-i98g + 77hc-ibv8` · FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31; predicted counts 2024-10-01 to 2025-09-30</sub>
- **Most common tipping measure: CAUTI.** For 193 of 581 penalized hospitals with a computable tipping measure, CAUTI is the measure needing the fewest prevented infections to clear the cutoff.  
  <sub>Source: `yq43-i98g + 77hc-ibv8` · FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31; predicted counts 2024-10-01 to 2025-09-30</sub>
- **Nurse communication vs Total HAC Score: r = -0.07.** Pearson correlation across 2,836 hospitals between HCAHPS nurse communication top-box and Total HAC Score. This is a correlation, not causation, and the two files cover different periods.  
  <sub>Source: `dgck-syfz + yq43-i98g` · HCAHPS 2024-10-01 to 2025-09-30; FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31</sub>
- **Peer group with the highest penalty rate (≥30 hospitals): 44.7%.** 100–299 beds · Major teaching · Urban · Midwest: 17 of 38 hospitals penalized.  
  <sub>Source: `yq43-i98g + cost report` · FY2026 HAC file; PSI 90 2022-07-01 to 2024-06-30, HAI 2023-01-01 to 2024-12-31</sub>
<!-- FINDINGS:END -->

## Methodology

CareSignal rebuilds the FY2026 HAC Reduction Program score in five steps:

1. Winsorize each measure at the 5th and 95th percentiles.
2. Standardize each measure to a z-score using the mean and SD of the Winsorized values.
3. Weight the measures equally across those the hospital actually has.
4. Sum the weighted z-scores to get the Total HAC Score.
5. Compare the total with the 75th-percentile cutoff.

Patients-to-prevent inverts that math one measure at a time: Δz = gap ÷ weight, ΔSIR = Δz × SD, Δinfections = ΔSIR × predicted infections, rounded up. The result respects the Winsorization bounds.

Full details are in [docs/methodology.md](docs/methodology.md). Field definitions are in [docs/data_dictionary.md](docs/data_dictionary.md).

## Validation

The rebuilt z-scores, Total HAC Scores and payment-reduction flags are compared hospital by hospital against the official CMS FY2026 HAC file (`yq43-i98g`). The targets are at least 99% penalty-flag agreement and z-scores within ±0.001. The match rate and every mismatch are published on the site's **Data Quality** page, along with every validation rule and how many records it checked.

## Run locally

Requirements: Python 3.12 and Node 20.

```bash
make venv          # create .venv and install Python deps
make all           # data pipeline → tests → web build → size guard
cd web && npx vite preview   # http://localhost:4173/caresignal/
```

Individual stages:

| Command | What it does |
|---|---|
| `make data` | Runs the full data pipeline |
| `make test` | Runs pytest and vitest |
| `make test-unit` | Runs only the tests that need no data |
| `make lint` | Runs ruff and ESLint |
| `make clean` | Removes the build outputs |

## Limitations

- CMS data lags by one to two years or more. CareSignal is a strategic radar, not real-time surveillance.
- It covers Medicare fee-for-service only, and the PSI measures are claims-based.
- Patients-to-prevent holds peer performance and the cutoff constant, but the real cutoff moves every year. Treat it as approximate.
- The program-year view uses predicted infection counts from the most recent HAI file as a proxy, because the HAC file does not publish them.
- VBP points are not fully reproduced; the tool shows percentile positions instead.
- SIRs with small denominators are unstable and often suppressed. The site shows confidence intervals and CMS footnotes.
- Dollar exposure (about 1% of Medicare inpatient payments) is an order-of-magnitude estimate.
- Nursing categories are an informed judgment, documented with a rationale for each measure.

See [docs/limitations.md](docs/limitations.md).

## Data sources

All data is public and comes from the Centers for Medicare & Medicaid Services.

- **CMS Provider Data Catalog datasets:**
  - Hospital General Information (`xubh-q36u`)
  - Healthcare Associated Infections (`77hc-ibv8`)
  - HCAHPS: hospital (`dgck-syfz`), national (`99ue-w85f`) and state (`84jm-wiui`)
  - Complications and Deaths (`ynj2-r877`)
  - PSI-90 six-digit estimates (`muwa-iene`)
  - HAC Reduction Program (`yq43-i98g`)
  - Hospital Readmissions Reduction Program (`9n3s-kdb3`)
  - HVBP Total Performance Score (`ypbt-wvdk`)
  - Unplanned Hospital Visits (`632h-zaca`)
  - Timely and Effective Care (`yv7e-xc69`)
- **data.cms.gov:**
  - Hospital Provider Cost Report
  - Medicare Inpatient Hospitals – by Provider
- **Methodology:** [CMS HAC Reduction Program](https://www.cms.gov/medicare/quality/value-based-programs/hospital-acquired-conditions)

CareSignal is not affiliated with or endorsed by CMS. Peer comparisons use groups of similar hospitals and never single out a named competitor.

## License

[MIT](LICENSE) © 2026 Devansh Chaudhary
