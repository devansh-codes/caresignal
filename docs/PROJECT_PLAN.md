# CareSignal — Project Plan

**Nursing-sensitive quality & CMS penalty radar for every U.S. hospital, built only on public CMS data.**

Live site (after deploy): `https://devansh-codes.github.io/caresignal/`
Repo: `https://github.com/devansh-codes/caresignal`
Cost to run: **$0** (GitHub Pages + GitHub Actions + public CMS data)

---

## 1. The problem

Medicare adjusts hospital payments through three quality programs. Many of the measures behind them are outcomes nursing directly influences.

- **Hospital-Acquired Condition (HAC) Reduction Program.** Hospitals whose Total HAC Score is above the 75th percentile (the worst-performing quartile) get a **1% payment reduction on all Medicare fee-for-service discharges** for the fiscal year. The score combines six measures:
  - CMS PSI 90, a composite of 10 patient-safety indicators that includes pressure ulcers (PSI 03) and in-hospital falls with hip fracture (PSI 08)
  - CLABSI
  - CAUTI
  - SSI (colon and abdominal hysterectomy surgery)
  - MRSA bacteremia
  - C. difficile
- **Hospital Value-Based Purchasing (VBP).** The Patient Experience domain is built from HCAHPS top-box scores. *Communication with Nurses* and *Discharge Information* stay in the domain through at least FY2030.
- **Hospital Readmissions Reduction Program (HRRP).** It penalizes excess 30-day readmissions. Discharge education and care transitions are shared nursing work.

**The gap:** the data is public but scattered across many CMS files. Each file uses different formats and footnote codes and covers different reporting periods. CMS publishes measure scores (z-scores, SIRs), but it never answers the question a CNO actually asks:

> *"How close is my hospital to a penalty line, which nursing-sensitive measure is driving it, and how many patient harms do we need to prevent to get clear?"*

**CareSignal answers that for any hospital.** It turns z-scores into **patients**: for example, *"about 3 fewer CAUTIs over the performance period would move this hospital below the HAC cutoff, holding peers constant."*

---

## 2. What the product does

| Feature | What the user sees |
|---|---|
| **Hospital search** | Type any hospital name, city or CCN. Works for roughly 5,400 facilities, and about 3,000 have HAC scores. |
| **Penalty proximity** | HAC position relative to the 75th-percentile cutoff, with each measure's contribution as a waterfall chart. |
| **Patients-to-prevent** | Converts each infection SIR gap into the number of infections to avoid, using observed and predicted counts. |
| **Nursing lens** | Each measure is tagged *Nursing-driven*, *Shared*, or *Other*, so nursing leaders can see what they own. |
| **Peer benchmark** | Compared against hospitals of similar size, teaching status, urban/rural setting and region, never against named competitors. |
| **What-if simulator** | Sliders such as "reduce CAUTI by N" or "+X pts nurse communication top-box" show the new HAC/VBP position. |
| **Patient experience** | HCAHPS nurse communication, discharge information and overall rating vs peer and national results. |
| **Readmissions** | HRRP excess readmission ratios by condition. |
| **National insights** | Computed findings across all hospitals (see §9). |
| **1-page brief** | A printable hospital brief, saved as PDF through the browser's Print dialog. |
| **Excel workbook** | A downloadable formula-driven workbook with a hospital selector and scenario inputs. |
| **Data quality page** | File freshness dates, every validation rule and the HAC rebuild accuracy. |

---

## 3. Data sources (all public, verified October 2026)

### 3a. CMS Provider Data Catalog (PDC) — hospital datasets

| Dataset | ID | Last modified | Used for |
|---|---|---|---|
| Hospital General Information | `xubh-q36u` | 2026-07-22 | Facility list, type, ownership, state, overall star rating |
| Healthcare Associated Infections – Hospital | `77hc-ibv8` | 2026-07-22 | SIR, observed (`_NUMERATOR`), predicted (`_ELIGCASES`), device days (`_DOPC`), CIs for HAI_1–HAI_6 |
| Patient survey (HCAHPS) – Hospital | `dgck-syfz` | 2026-07-22 | `H_COMP_1_A_P` (nurse comm. "Always"), nurse respect/listen/explain, discharge info, star ratings |
| Complications and Deaths – Hospital | `ynj2-r877` | 2026-09-10 | PSI_03, PSI_08, PSI_90 and other PSIs |
| CMS Medicare PSI-90 and component measures – six-digit estimate | `muwa-iene` | — | Precise PSI-90 component values for the HAC rebuild |
| Hospital-Acquired Condition (HAC) Reduction Program | `yq43-i98g` | 2026-01-26 | FY2026 official measure values, Winsorized z-scores, Total HAC Score, payment reduction flag (ground truth) |
| Hospital Readmissions Reduction Program | `9n3s-kdb3` | 2026-01-26 | Excess readmission ratios by condition |
| HVBP – Total Performance Score | `ypbt-wvdk` | 2026-01-26 | VBP domain scores and TPS |
| Unplanned Hospital Visits – Hospital | `632h-zaca` | 2026-09-10 | Readmission and return-visit measures |
| Timely and Effective Care – Hospital | `yv7e-xc69` | 2026-07-22 | SEP-1 sepsis bundle and other process measures |
| HCAHPS – National / State | `99ue-w85f` / `84jm-wiui` | — | National and state benchmarks |

**API pattern (verified):**
```
# Metadata (includes the current CSV downloadURL and 'modified' date)
https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/{dataset_id}

# Row-level query (JSON; keys: results, count, schema, query)
https://data.cms.gov/provider-data/api/1/datastore/query/{dataset_id}/0?limit=500&offset=0
```

**Recommended approach:** call the metastore and read `distribution[0].downloadURL`, then download the full CSV in one request. The download URL changes every refresh, so never hard-code it. This avoids paging limits entirely. Use the datastore query endpoint only for spot checks.

**Data quirks to handle (verified):**
- All fields arrive as text.
- Missing values appear as `N/A` (HAC file) or `Not Available` (HAI/HCAHPS), with a footnote code in the adjacent column. Values can also be numeric *and* footnoted, such as `0.000` with footnote 29.
- Dates are text in `MM/DD/YYYY` format.
- Reporting periods differ by file. In the FY2026 HAC file, PSI 90 covers 07/01/2022–06/30/2024 and HAI measures cover 01/01/2023–12/31/2024. The current HAI and HCAHPS files cover 10/01/2024–09/30/2025.
- Column names differ between the CSV ("Facility ID") and the API (`facility_id`). Normalize to snake_case.
- CCN is a 6-character string with leading zeros (`010001`). Never cast it to an integer.

### 3b. Other CMS sources

| Source | Used for |
|---|---|
| **Hospital Provider Cost Report** (data.cms.gov, annual; dataset page lists 2011–2022, so check for newer years) | Bed count, intern/resident FTEs (teaching status), urban/rural, discharges, which together define **peer groups** |
| **Medicare Inpatient Hospitals – by Provider** (data.cms.gov) | Total Medicare payments per hospital, used to **estimate the 1% HAC dollar exposure** |
| **FY HAC methodology infographic** (cms.gov) | Scoring rules for the rebuild |
| **HCAHPS Online – HCAHPS and Hospital VBP** | VBP dimension list by fiscal year |

> Before coding, confirm exact column names against each data dictionary. The cost report and Medicare inpatient files use different schemas from the PDC.

---

## 4. Methods

### 4.1 HAC score rebuild (FY2026 CMS methodology)
1. **Inputs:** PSI 90 composite value plus the SIRs for CLABSI, CAUTI, SSI, CDI and MRSA.
2. **Winsorize** each measure at the 5th and 95th percentiles, calculated across all subsection (d) hospitals with a result, including Maryland.
3. **Standardize** to a z-score using the mean and SD of the Winsorized values for the same hospital group. Higher z means worse performance.
4. **Weight equally** across the measures the hospital actually has. With 6 measures each gets 1/6; with 5, 1/5; and so on. A measure with no result gets no weight.
5. **Total HAC Score** = Σ(z × weight).
6. **Cutoff** = 75th percentile of Total HAC Scores among non-Maryland subsection (d) hospitals with a score. Hospitals above the cutoff are penalized.
7. **Validate against ground truth:** compare the rebuilt z-scores, Total HAC Score and penalty flag against the official `yq43-i98g` file. Report the match rate (target: >99% penalty-flag agreement, z-scores within ±0.001) on the Data Quality page. **This is the credibility anchor of the project.**

### 4.2 Patients-to-prevent
For hospital *h* and HAI measure *m*:
- Gap to cutoff: `Δ = TotalHAC_h − cutoff`. If Δ ≤ 0, the hospital is already clear and the tool shows its "cushion" instead.
- Required change in that measure's z-score: `Δz = Δ / weight_h`
- Required SIR change: `ΔSIR = Δz × SD_m`. Re-check the result against the Winsorization bounds.
- Infections to prevent: `ΔO = ΔSIR × Predicted_m`, rounded up to whole infections.
- Show the single cheapest measure, the fewest events that clears the line, as the **"tipping measure."**

Always label this as **approximate**. It holds peer performance and the cutoff constant, and the cutoff moves every year.

**Two views, clearly labeled:**
- **Program year view** uses the official HAC file. This is the period that actually determined the FY2026 penalty.
- **Current trajectory view** uses the latest HAI file (10/2024–09/2025) with the FY2026 distribution as a proxy. It works as an early warning for upcoming program years.

### 4.3 Nursing-sensitive measure map (`config/measure_map.yaml`)

| Category | Measures |
|---|---|
| **Nursing-driven** | CAUTI (HAI_2), CLABSI (HAI_1), PSI 03 pressure ulcer, PSI 08 in-hospital fall with hip fracture, HCAHPS nurse communication (H_COMP_1), nurse respect/listen/explain |
| **Shared** | CDI (HAI_6) and MRSA (HAI_5) with Infection Prevention/EVS; HCAHPS discharge info and care transition; HRRP readmissions; SEP-1 sepsis bundle |
| **Other** | SSI (HAI_3/HAI_4), surgical PSI components, physician communication |

Each mapping comes with a written rationale, shown in the UI tooltip.

### 4.4 Peer groups (transparent rules, not black-box clustering)
- **Bed size:** <100, 100–299, 300–499, 500+
- **Teaching:** none / minor / major, based on the resident-FTE-to-bed ratio
- **Location:** urban / rural
- **Region:** the 4 Census regions, derived from state

Peer groups need at least 15 hospitals. Smaller groups fall back to bed size plus teaching only.

### 4.5 HCAHPS and readmissions
- Nurse communication top-box (`H_COMP_1_A_P`) as a percentile vs peers, state and nation.
- HRRP excess readmission ratio (ERR) by condition; values above 1.0 are highlighted.
- The simulator shows a hospital's percentile after a +X point top-box gain. It **does not** reproduce exact VBP points, since achievement and improvement thresholds come from separate files; say so explicitly.

### 4.6 Dollar exposure (estimate)
`Exposure ≈ 1% × total Medicare inpatient payments` (from Medicare Inpatient Hospitals – by Provider). Label it as an order-of-magnitude estimate. The actual reduction applies to FFS base operating DRG payments.

---

## 5. Architecture

```
            ┌──────────────────────── GitHub Actions (weekly cron + manual) ───────────────────────┐
CMS APIs ──▶│ 1. fetch.py   metastore → downloadURL → raw CSV  (+ manifest.json with modified dates)│
            │ 2. validate.py  schema, CCN, footnotes, N/A, ranges → dq_log.csv                      │
            │ 3. transform.py DuckDB SQL → tidy tables                                              │
            │ 4. hac_rebuild.py  winsorize/z/weights → compare to official → accuracy.json          │
            │ 5. metrics.py  patients-to-prevent, peers, percentiles, national insights             │
            │ 6. export.py   site JSON (index + per-hospital shards) + Excel workbook               │
            │ 7. pytest      methodology + data contract tests (fail = no deploy)                   │
            │ 8. vite build  → upload-pages-artifact → deploy-pages                                 │
            └──────────────────────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
                    GitHub Pages (static): React app reads precomputed JSON
                    https://devansh-codes.github.io/caresignal/
```

**Why precompute everything:** the site is static, so there are no servers, API keys, CORS problems or costs. Every number on the site traces back to a versioned build artifact.

**History:** each run commits a small `data/snapshots/YYYY-MM-DD/manifest.json` plus key metrics, so trend history builds up over time in git.

---

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Pipeline | Python 3.12, `requests`, `pandas`, `duckdb`, `pyyaml` | DuckDB lets the core logic live in SQL, so it reads as analyst work |
| Validation | `pandera` (or hand-written checks) + `dq_log.csv` | Auditable rule log |
| Tests | `pytest` | Methodology tests on known hospitals; data contracts |
| Excel | `openpyxl` (formulas, data validation, conditional formatting) | A live workbook, not pasted values |
| Frontend | **Vite + React + TypeScript** | Fast static build, simple Pages deploy |
| Charts | **Apache ECharts** (`echarts-for-react`) | Waterfall, bullet, distribution and scatter charts; good accessibility; no license cost |
| Styling | Tailwind CSS | Quick, consistent UI |
| Search | `fuse.js` over a ~400 KB `index.json` | Client-side fuzzy hospital search |
| Routing | `HashRouter` (`/#/hospital/010001`) | GitHub Pages has no SPA fallback, so hash routes avoid 404s |
| CI/CD | GitHub Actions: `actions/upload-pages-artifact` + `actions/deploy-pages` | Free; custom workflows aren't subject to Pages' 10-builds/hour soft limit |
| Quality | ESLint, Prettier, Ruff, Lighthouse CI (optional) | Polished signals for reviewers |

**GitHub Pages limits (verified):** published sites up to 1 GB, a soft bandwidth limit of 100 GB/month, and deployments time out after 10 minutes. Keep the site data under about 50 MB by sharding per hospital and gzipping JSON. Do the heavy compute in the pipeline job, not the deploy step.

---

## 7. Repository structure

```
caresignal/
├── .github/workflows/
│   ├── pipeline-and-deploy.yml     # cron weekly + on push to main + manual
│   └── ci.yml                      # lint + tests on PRs
├── config/
│   ├── datasets.yaml               # dataset IDs, expected columns, file roles
│   ├── measure_map.yaml            # nursing-driven / shared / other + rationale
│   └── peer_rules.yaml
├── pipeline/
│   ├── fetch.py
│   ├── validate.py
│   ├── transform.py
│   ├── hac_rebuild.py
│   ├── metrics.py
│   ├── export_site.py
│   ├── export_excel.py
│   └── sql/                        # 01_hospitals.sql, 02_hai_long_to_wide.sql, 03_hcahps.sql, ...
├── tests/
│   ├── test_hac_rebuild.py         # rebuilt z-scores == official within tolerance
│   ├── test_patients_to_prevent.py # math on hand-checked examples
│   └── test_data_contracts.py      # CCN format, required columns, no duplicate CCNs
├── data/
│   ├── raw/        (gitignored)
│   ├── processed/  (gitignored)
│   └── snapshots/  (committed: manifests + key metrics only)
├── web/
│   ├── index.html
│   ├── vite.config.ts              # base: '/caresignal/'
│   ├── public/data/                # generated JSON (gitignored, built in CI)
│   └── src/
│       ├── pages/ Home.tsx, Hospital.tsx, Insights.tsx, Methods.tsx, DataQuality.tsx
│       ├── components/ SearchBar, PenaltyGauge, HacWaterfall, PatientsToPrevent,
│       │               PeerDistribution, WhatIfPanel, HcahpsCard, ReadmissionTable,
│       │               NursingBadge, FreshnessBanner, PrintBrief
│       └── lib/ data.ts, format.ts, simulate.ts
├── docs/  methodology.md, data_dictionary.md, limitations.md, screenshots/
├── README.md
├── LICENSE (MIT)
└── Makefile                        # make data | make test | make web | make all
```

---

## 8. Frontend pages

1. **Home**
   - Hero tagline: "How close is your hospital to a Medicare quality penalty — and how many patients would change that?"
   - Search bar and three national headline stats (computed)
   - Data freshness banner showing the `modified` date of each source
2. **Hospital view** (`/#/hospital/:ccn`)
   - Header: name, city/state, type, peer group, star rating
   - **Penalty gauge:** Total HAC Score vs cutoff, with an "Above cutoff / Within X / Clear by X" status
   - **HAC waterfall:** each measure's weighted contribution, color-coded by nursing category
   - **Patients-to-prevent cards:** "Prevent ~N CAUTIs → clears cutoff" for each HAI, with the tipping measure highlighted
   - **Peer distribution:** strip or histogram with this hospital marked, one per measure
   - **HCAHPS card:** nurse communication, respect, listen, explain and discharge info vs peer and nation
   - **Readmissions table:** HRRP ERR by condition
   - **What-if panel:** sliders that recompute in the browser (`simulate.ts` mirrors the Python math and is unit-tested against it)
   - **"Print brief"** button: print-optimized 1-page layout
3. **National insights**
   - Distribution of Total HAC Scores with the cutoff line
   - Share of HAC weighted points from nursing-driven measures
   - Number of hospitals within 1–2 infections of the line
   - Most common tipping measure
   - Nurse communication top-box vs HAC score (scatter)
   - Breakdowns by peer group
4. **Methods:** plain-English methodology, formulas and the measure-map rationale
5. **Data quality:** source manifest, validation rules with record counts, HAC rebuild match rate and limitations
6. **Downloads:** Excel workbook, processed CSVs and `dq_log.csv`

**Design:** clean clinical palette, accessible contrast (WCAG AA), mobile-first layout, and light and dark themes. Every number has a tooltip naming its source file and period.

---

## 9. National insights to compute (never assume them)

Pull these from the data and only then put them on the site and in the pitch:
- Count and % of hospitals penalized in the FY2026 HAC file, nationally and by peer group
- % of total weighted HAC points that come from nursing-driven measures (CAUTI + CLABSI + the PSI 03/08 share)
- Number of penalized hospitals that would clear the cutoff with ≤2 fewer infections in one measure
- Number of currently clear hospitals within ≤2 infections of crossing it
- Most frequent tipping measure
- Correlation between nurse communication top-box and Total HAC Score (correlation only; do not imply causation)

---

## 10. Excel workbook (`CareSignal_Workbook.xlsx`, generated each build)

| Sheet | Contents |
|---|---|
| README | Purpose, sources, refresh date |
| Data | All hospitals as an Excel Table (CCN, peer group, measures, z-scores, Total HAC) |
| Hospital Lookup | Dropdown (data validation) → `XLOOKUP` pulls every metric. Conditional formatting against the cutoff. Peer averages via `AVERAGEIFS` |
| HAC Calculator | Recomputes winsorization, z-scores, weights and total with live formulas (`PERCENTILE.INC`, `AVERAGE`, `STDEV.P`, `LET`). Blue input cells hold what-if changes |
| Patients to Prevent | Formula version of §4.2 |
| Peer Benchmark | Percentile ranks (`PERCENTRANK.INC`) per measure within the peer group |
| HCAHPS | Nurse communication percentile and gap to peer median |
| DQ Log | Validation rules and counts |
| Definitions | Measure dictionary with nursing category |

Verify it by recalculating in LibreOffice in CI: the values must match the Python outputs.

---

## 11. Deployment (GitHub Pages, free)

### One-time setup
1. Create a **public** repo named `caresignal`.
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. In `web/vite.config.ts`, set `base: '/caresignal/'`.
4. Push to `main`. The workflow builds and deploys automatically.
5. The production link is `https://devansh-codes.github.io/caresignal/`. Add it to the repo's "About" box and the README badge.

### `.github/workflows/pipeline-and-deploy.yml`
```yaml
name: Pipeline & Deploy
on:
  push: { branches: [main] }
  schedule: [{ cron: "17 9 * * 1" }]   # Mondays 09:17 UTC — picks up CMS refreshes
  workflow_dispatch:

permissions:
  contents: write      # commit snapshot manifests
  pages: write
  id-token: write

concurrency: { group: pages, cancel-in-progress: false }

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12", cache: pip }
      - run: pip install -r requirements.txt
      - run: make data          # fetch → validate → transform → rebuild → metrics → export
      - run: pytest -q          # methodology + contract tests gate the deploy
      - name: Commit snapshot manifest
        run: |
          git config user.name "caresignal-bot"
          git config user.email "actions@users.noreply.github.com"
          git add data/snapshots
          git diff --cached --quiet || git commit -m "data: snapshot $(date -u +%F)" && git push
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: web/package-lock.json }
      - run: npm ci && npm run build
        working-directory: web
      - uses: actions/upload-pages-artifact@v3
        with: { path: web/dist }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> Implementation note: the workflow in `.github/workflows/pipeline-and-deploy.yml` refines this sketch. It guards the snapshot push with an explicit `if`, rebases before pushing, caches raw CMS data weekly, runs vitest and enforces a size guard.

### Safeguards
- **Change detection:** if no CMS `modified` date has changed since the last snapshot, skip re-processing and redeploy the cached data.
- **Fail closed:** if a schema check or the HAC rebuild accuracy fails, the job fails and the **previous site stays live**.
- **Retries:** fetch with exponential backoff, and record the HTTP status in the manifest.
- **Size guard:** fail the build if `web/dist` exceeds 200 MB.
- **Optional custom domain:** add a `CNAME` file and DNS record. The `github.io` URL is fine and free.

---

## 12. Build timeline (about 3 weeks part-time)

| Phase | Days | Deliverable | Done when |
|---|---|---|---|
| 0. Setup | 0.5 | Repo, Makefile, CI skeleton, Pages enabled | "Hello" page live at the production URL |
| 1. Fetch + manifest | 1 | `fetch.py` pulls all datasets via the metastore | Raw CSVs and `manifest.json` with modified dates |
| 2. Validate + transform | 2 | `validate.py`, DuckDB SQL, tidy tables | `dq_log.csv`; contract tests pass |
| 3. HAC rebuild | 2 | `hac_rebuild.py` + tests | ≥99% penalty-flag agreement with the official file |
| 4. Metrics | 2 | Patients-to-prevent, peers, percentiles, national insights | Hand-checked on 5 hospitals |
| 5. Frontend | 5 | All pages, charts, search, simulator, print brief | Lighthouse ≥90 on performance and accessibility |
| 6. Excel | 1.5 | Workbook generator | LibreOffice recalculation matches Python |
| 7. Docs + polish | 1.5 | README, methodology, limitations, screenshots, demo GIF | A stranger can understand the project in 60 seconds |
| 8. Launch | 0.5 | Tag `v1.0`, production link in README and LinkedIn | Weekly cron runs green |

---

## 13. README outline (public)

1. One-line pitch, production link and screenshot or GIF
2. The problem (3 sentences)
3. What it does (feature bullets)
4. How it works (architecture diagram)
5. Key national findings (computed numbers with file and period)
6. Methodology summary and link to `docs/methodology.md`
7. Validation: HAC rebuild match rate and the data quality approach
8. Run locally: `make all`
9. Limitations
10. Data sources and license

Keep the README product-focused. **Do not** put any job-description mapping in the repo.

---

## 14. Limitations (state openly)

- CMS data lags 1–2+ years, so this is a strategic radar rather than real-time surveillance. The same engine could run on a hospital's internal NHSN and incident data for monthly tracking.
- The data covers Medicare FFS only. PSI measures are derived from claims.
- Patients-to-prevent holds peers and the cutoff constant, while the real cutoff shifts every year.
- VBP points are not fully reproduced; the tool shows percentile positions instead.
- Small denominators make SIRs unstable, and many are suppressed (see footnotes). The UI shows confidence intervals and suppression notes.
- Dollar exposure is an estimate.
- Nursing categories are an informed judgment, documented with a rationale.

---

## 15. Hackathon demo script (3 minutes)

1. **Hook (20 s):** "Hospitals in the worst quartile on hospital-acquired conditions lose 1% of Medicare payments. Many of those measures are nursing-sensitive. Nobody tells a CNO how many infections stand between them and the penalty."
2. **Search (30 s):** pick an anonymized example hospital and show the penalty gauge and waterfall.
3. **The wow (40 s):** the patients-to-prevent card ("3 CAUTIs"), then move the what-if slider and watch it cross the line.
4. **National view (30 s):** one computed headline insight.
5. **Trust (30 s):** the Data Quality page, with the rebuild matching the official CMS scores at X% and every rule logged.
6. **Close (30 s):** "Free, open, refreshed weekly from CMS, and works for any of ~3,000 hospitals."

---

### Sources
- CMS — Hospital-Acquired Condition Reduction Program: https://www.cms.gov/medicare/quality/value-based-programs/hospital-acquired-conditions
- CMS — FY2026 HAC Reduction Program Methodology Infographic: https://www.cms.gov/files/document/fy-2026-hac-reduction-program-methodology-infographic-updated-08/04/2025.pdf
- HCAHPS Online — HCAHPS and Hospital VBP: https://hcahpsonline.org/en/hcahps-and-hospital-vbp/
- CMS Provider Data Catalog API (metastore example): https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/xubh-q36u
- FY2026 HAC Reduction Program file: https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/yq43-i98g
- Data.gov — Hospital Provider Cost Report: https://catalog.data.gov/dataset/hospital-provider-cost-report
- Data.gov — Healthcare Associated Infections, Hospital: https://catalog.data.gov/dataset/healthcare-associated-infections-hospital
- GitHub Docs — GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
