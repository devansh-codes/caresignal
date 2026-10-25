# Limitations

CareSignal is a strategic radar built on public, lagged, claims-based and surveillance data. Read its numbers with these limits in mind.

## Data timeliness
- CMS data lags by one to two years or more. The FY2026 HAC file scores PSI 90 for 07/01/2022–06/30/2024 and the HAI measures for 01/01/2023–12/31/2024.
- The current HAI and HCAHPS files cover later periods. The site labels each period separately and never mixes them silently.
- The same engine could run monthly on a hospital's internal NHSN and incident data. Public data can't support real-time surveillance.

## Coverage
- HAC, HRRP and VBP apply to subsection (d) acute-care hospitals paid under IPPS. Critical access hospitals, children's hospitals and some specialty hospitals appear in search but have no HAC score.
- Maryland hospitals are scored but are not subject to the HAC payment reduction in the same way.
- PSI measures come from Medicare fee-for-service claims, so they reflect coding as well as care.

## Patients-to-prevent
- It is approximate. It holds other hospitals' performance and the cutoff constant, but the real 75th-percentile cutoff moves every year.
- It changes one measure at a time. Real improvement usually spreads across several measures.
- The HAC file does not publish predicted infection counts. The program-year view uses predicted counts from the most recent HAI file, which covers a different period, as a proxy.
- Winsorization bounds cap what one measure can do. If a hospital's SIR is above the 95th-percentile bound, the first reductions do not change its score. If the required change would fall below the 5th-percentile bound, that measure alone cannot clear the cutoff, and the site says so.
- PSI 90 is a composite rate, so it is reported as a required change in the composite, not as a count of events.

## Statistical stability
- SIRs with small predicted counts are unstable, and CMS suppresses many of them (see the footnote codes). The site shows confidence intervals and footnotes rather than hiding them.
- A missing value is shown as "—", never as zero.

## Programs not fully reproduced
- The VBP Total Performance Score is shown as published. The what-if simulator reports percentile changes for HCAHPS top-box scores, not VBP achievement or improvement points.
- The HRRP payment adjustment factor is not recomputed. Excess readmission ratios are shown as published.

## Estimates and judgments
- Dollar exposure (about 1% of Medicare inpatient payments) is an order-of-magnitude estimate. The actual reduction applies to fee-for-service base operating DRG payments.
- Peer groups depend on the latest cost report available. Hospitals without a cost-report match have no peer group.
- The nursing-driven, shared and other categories are informed judgments, each documented with a rationale in `config/measure_map.yaml`.
- Correlations, such as nurse communication against HAC score, describe association only, never causation.

CareSignal is not affiliated with or endorsed by CMS.
