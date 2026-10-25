# Methodology

CareSignal turns public CMS quality files into one question a nurse leader can act on: *how close is this hospital to a Medicare penalty line, and how many patient harms stand between it and the line?*

The numbers on the site come from the pipeline described here. The site shows each number with the CMS dataset ID and reporting period it came from.

## 1. Data ingestion

Each CMS Provider Data Catalog dataset is fetched in four steps:

1. Read the metastore record: `https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/{id}`.
2. Download the full CSV from `distribution[0].downloadURL`. The URL is never hard-coded, because it changes on every CMS refresh.
3. Record the dataset's `modified` date, HTTP status, row count, SHA-256 and fetch time in `manifest.json`.
4. Skip the download when `modified` has not changed since the last run (`--if-changed`).

Cost report and Medicare inpatient files come from `data.cms.gov`, located by title in `https://data.cms.gov/data.json`.

Normalization rules:
- CCN is kept as a 6-character string with leading zeros.
- `Not Available`, `N/A` and blanks become null. Footnote codes are kept in their own columns.
- Dates are converted from `MM/DD/YYYY` to ISO `YYYY-MM-DD`.

## 2. Validation

`validate.py` runs named rules. Each rule has an ID, a severity (`error`, `warn` or `info`), the number of records checked and the number that failed. The rules cover:
- required columns
- CCN format and uniqueness
- numeric ranges
- footnote and suppression consistency
- date parsing

Results go to `dq_log.csv` and the Data Quality page. Any `error` failure stops the build, so the previous site stays live.

## 3. HAC Reduction Program rebuild (FY2026)

Inputs come from the official FY2026 HAC file (`yq43-i98g`): the PSI 90 composite value and the SIRs for CLABSI, CAUTI, SSI (colon and abdominal hysterectomy combined), CDI and MRSA bacteremia.

1. **Winsorize** each measure at its 5th and 95th percentiles across all hospitals with a result.
2. **Standardize:** z = (w − mean) / SD. The mean and SD are computed over the Winsorized values; a higher z is worse.
3. **Weight equally** across the measures a hospital has: 1/6 each with six results, 1/5 with five, and so on. A measure with no result gets no weight.
4. **Total HAC Score** = Σ z × weight.
5. **Cutoff** = the 75th percentile of Total HAC Scores. Hospitals above it are in the worst-performing quartile and receive the 1% payment reduction.
6. **Validate** the rebuilt z-scores, totals and payment flags against the official columns, hospital by hospital. The match rate, the largest z difference per measure and every mismatch are published in `accuracy.json` and on the Data Quality page.

The exact percentile method and SD definition are the ones that reproduce the official file. `pipeline/hac_core.py` documents the choice.

## 4. Patients-to-prevent

For hospital *h*, HAI measure *m* and gap Δ = Total HAC − cutoff:

| Step | Formula |
|---|---|
| Required z change | Δz = Δ / weight_h |
| Required change in the Winsorized value | Δw = Δz × SD_m |
| Bound check | If the current SIR is above the upper Winsorization bound, the first part of any reduction changes nothing. If the target falls below the lower bound, that measure alone cannot clear the cutoff and is marked infeasible. |
| Infections to prevent | ΔO = ΔSIR × predicted infections, rounded **up** to whole infections |

The **tipping measure** is the feasible measure that needs the fewest infections.

For hospitals already clear of the cutoff, the same math runs in reverse to give a **cushion**: how many added infections in one measure would push the hospital over the line. A hospital whose smallest cushion is no more than two infections is labeled **Near cutoff**.

PSI 90 is a composite rate, not a count, so the tool shows the required change in the composite value instead of a number of events.

The estimate is **approximate**. It holds every other hospital's performance and the cutoff constant, and the real cutoff moves every year.

### Two views
- **Program year (FY2026)** uses the official HAC file, the data that actually determined the FY2026 penalty. The HAC file does not publish predicted infection counts, so predicted counts come from the most recent HAI file (`77hc-ibv8`) as a proxy. For SSI, the colon and hysterectomy predicted counts are summed.
- **Current trajectory** uses the most recent HAI SIRs and PSI 90 estimates, scored against the FY2026 Winsorization bounds, means, SDs and cutoff. It is an early warning, not a prediction of a future penalty.

## 5. Nursing-sensitive measure map

`config/measure_map.yaml` assigns each measure a category, with a written rationale shown in the UI:

| Category | Measures |
|---|---|
| **Nursing-driven** | CAUTI, CLABSI, PSI 03 (pressure ulcer), PSI 08 (in-hospital fall with hip fracture), HCAHPS communication with nurses and the nurse respect, listen and explain items |
| **Shared** | CDI and MRSA (with Infection Prevention and Environmental Services), HCAHPS discharge information and care transition, HRRP readmissions, SEP-1 sepsis bundle |
| **Other** | SSI, surgical PSI components, physician communication |

## 6. Peer groups

Peer groups use transparent rules, not clustering:

| Dimension | Rule |
|---|---|
| Bed size | under 100, 100–299, 300–499, 500 or more (cost report beds) |
| Teaching | none when the resident FTE-to-bed ratio is 0, minor below 0.25, major at 0.25 or above |
| Location | urban or rural, from the cost report |
| Region | the four Census regions, derived from state; territories are grouped separately |

A group needs at least 15 HAC-scored hospitals. Smaller groups fall back to bed size plus teaching only. Hospitals with no cost-report match have no peer group. Comparisons are always against the distribution of the group, never against a named hospital.

## 7. Patient experience and readmissions

- **HCAHPS:** each hospital's top-box percentage (for example `H_COMP_1_A_P`, nurses "Always" communicated well) is ranked as a percentile against all hospitals and against its peer group. State and national benchmarks come from the HCAHPS State and National files.
- **Readmissions:** HRRP excess readmission ratios by condition, with values above 1.0 highlighted.
- **VBP:** the simulator reports percentile movement only. It does not reproduce VBP achievement or improvement points, which depend on thresholds in separate files.

## 8. Dollar exposure

Exposure ≈ 1% × total Medicare payments from *Medicare Inpatient Hospitals – by Provider*. It is an order-of-magnitude estimate. The actual reduction applies to fee-for-service base operating DRG payments.

## 9. National insights

Insights are computed from the data at build time and never hard-coded:
- penalized count and share, nationally and by peer group
- share of weighted HAC points from nursing-driven measures
- penalized hospitals that would clear with two or fewer fewer infections in one measure
- clear hospitals within two infections of crossing the cutoff
- the most frequent tipping measure
- the Pearson correlation between nurse-communication top-box and Total HAC Score (correlation only, not causation)

## 10. Testing

| Test file | What it checks |
|---|---|
| `test_hac_rebuild.py` | Rebuilt z-scores and totals match the official file within tolerance, and flag agreement is at least 99% |
| `test_patients_to_prevent.py` | Hand-checked examples, including the Winsorization edge cases |
| `test_data_contracts.py` | CCN format, required columns and no duplicate CCNs |
| `web/src/lib/simulate.test.ts` | The browser simulator reproduces the Python results |

Tests that need pipeline outputs are marked `@pytest.mark.data`. They run in the deploy pipeline after `make data` and are excluded from pull-request CI.
