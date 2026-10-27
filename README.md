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
_Worked out by the pipeline from public CMS files (built 2026-10-27). Each finding names its source file and time period._

- **2,917** of 5,419 hospitals have a FY2026 safety score (Total HAC Score). The penalty line is a score above **0.37955** (`yq43-i98g`).
- **About 1 in 4 hospitals lose 1% of their Medicare payments in FY2026** (719 (23.9%)). CMS made a penalty decision for 3,012 hospitals and penalized 719 of them. 718 of those have a published safety score (hospital 440218 is penalized without a published score). 2 penalized hospitals are missing from the CMS hospital list, so CareSignal shows 716 penalized hospitals. 43 Maryland hospitals get a score but are exempt from the penalty. The penalty line is a safety score above 0.37955.  
  <sub>Source: CMS Hospital Acquired Condition Reduction Program (yq43-i98g). FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024</sub>
- **Nursing driven infections make up 27% of what pushes penalized hospitals over the line** (27.0%). At penalized hospitals, 27.0% of the points above average come from central line and catheter infections, which nursing drives. Shared measures add 55.7% and surgical site infections add 17.3%. Patient safety events (PSI 90) count as shared because the public data cannot separate out the parts nursing drives (pressure injuries and falls).  
  <sub>Source: CMS Hospital Acquired Condition Reduction Program (yq43-i98g). FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024</sub>
- **404 penalized hospitals are 2 or fewer infections away from getting clear** (404 of 716). Preventing 2 or fewer infections of a single type would bring 404 penalized hospitals to or below the penalty line, if other hospitals and the line stayed the same. Expected infection counts come from the newer CMS infections file, so this is an estimate.  
  <sub>Source: CMS Hospital Acquired Condition Reduction Program (yq43-i98g) and CMS Healthcare Associated Infections (77hc-ibv8). FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024. Expected infections Oct 1, 2024 to Sep 30, 2025</sub>
- **795 hospitals below the line could cross it with just 2 more infections** (795). 795 hospitals below the penalty line would cross it with 2 or fewer extra infections of a single type. Where only a few infections are expected, one more case moves the score a lot.  
  <sub>Source: CMS Hospital Acquired Condition Reduction Program (yq43-i98g) and CMS Healthcare Associated Infections (77hc-ibv8). FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024. Expected infections Oct 1, 2024 to Sep 30, 2025</sub>
- **Catheter infections (CAUTI) are most often the quickest way to get clear** (Catheter infections (CAUTI)). For 193 of 581 penalized hospitals where this can be worked out, preventing catheter infections (CAUTI) takes the fewest infections to get below the penalty line.  
  <sub>Source: CMS Hospital Acquired Condition Reduction Program (yq43-i98g) and CMS Healthcare Associated Infections (77hc-ibv8). FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024. Expected infections Oct 1, 2024 to Sep 30, 2025</sub>
- **Nurse communication scores and safety scores are barely linked** (r = −0.07). Across 2,836 hospitals, we compared how often patients said nurses always communicated well with each hospital's safety score. A value near 0 means little connection. This shows a pattern, not a cause, and the two files cover different time periods.  
  <sub>Source: CMS Patient Survey, HCAHPS (dgck-syfz) and CMS Hospital Acquired Condition Reduction Program (yq43-i98g). Patient survey Oct 1, 2024 to Sep 30, 2025. FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024</sub>
- **Group of similar hospitals with the highest penalty rate (30 or more hospitals)** (44.7%). 100 to 299 beds, major teaching, urban, Midwest: 17 of 38 hospitals penalized.  
  <sub>Source: CMS Hospital Acquired Condition Reduction Program (yq43-i98g) and CMS Hospital Provider Cost Report. FY2026 penalty file. Safety events Jul 1, 2022 to Jun 30, 2024; infections Jan 1, 2023 to Dec 31, 2024</sub>
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
