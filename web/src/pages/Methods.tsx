import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBadge, PageHeader, SourceNote, StateView } from '../components/ui'
import { Formula } from '../components/insights/Formula'
import { Toc } from '../components/insights/Toc'
import { SortableTable, type Column } from '../components/insights/SortableTable'
import { LIMITATIONS } from '../components/insights/content'
import { loadMeasures, loadNational, useData } from '../lib/data'
import { HAC_LABELS, fmt, fmtInt } from '../lib/format'
import type { Category, HacMeasureKey, HacParams, MeasureDef } from '../lib/types'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'hac', label: 'HAC score rebuild' },
  { id: 'parameters', label: 'FY parameters' },
  { id: 'ptp', label: 'Patients-to-prevent' },
  { id: 'views', label: 'Program year vs trajectory' },
  { id: 'status', label: 'Status definitions' },
  { id: 'nursing', label: 'Nursing measure map' },
  { id: 'peers', label: 'Peer groups' },
  { id: 'hcahps', label: 'HCAHPS & readmissions' },
  { id: 'exposure', label: 'Dollar exposure' },
  { id: 'limitations', label: 'Limitations' },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border pb-8 last:border-0">
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink/90">{children}</div>
    </section>
  )
}

const MEASURE_ORDER: HacMeasureKey[] = ['psi90', 'clabsi', 'cauti', 'ssi', 'cdi', 'mrsa']

function ParamsTable({ p }: { p: HacParams }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-max text-sm">
        <caption className="sr-only">FY{p.fiscal_year} Winsorization bounds, mean and standard deviation by HAC measure</caption>
        <thead className="bg-surface-2">
          <tr>
            {['Measure', '5th pct (floor)', '95th pct (cap)', 'Mean (winsorized)', 'SD (winsorized)', 'Hospitals'].map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${i ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEASURE_ORDER.map((k) => {
            const m = p.measures[k]
            if (!m) return null
            return (
              <tr key={k} className="border-t border-border/60">
                <th scope="row" className="px-3 py-2 text-left font-medium">{HAC_LABELS[k]}</th>
                <td className="tabular px-3 py-2 text-right">{fmt(m.winsor_low, 4)}</td>
                <td className="tabular px-3 py-2 text-right">{fmt(m.winsor_high, 4)}</td>
                <td className="tabular px-3 py-2 text-right">{fmt(m.mean, 4)}</td>
                <td className="tabular px-3 py-2 text-right">{fmt(m.sd, 4)}</td>
                <td className="tabular px-3 py-2 text-right">{fmtInt(m.n)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const CAT_ORDER: Record<Category, number> = { nursing: 0, shared: 1, other: 2 }
const measureCols: Column<MeasureDef>[] = [
  {
    key: 'label', header: 'Measure and rationale', sortValue: (m) => m.label,
    render: (m) => (
      <div className="max-w-md whitespace-normal">
        <div className="font-medium">{m.label} <span className="font-mono text-[11px] font-normal text-muted">{m.id}</span></div>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{m.rationale}</p>
      </div>
    ),
  },
  { key: 'category', header: 'Category', sortValue: (m) => CAT_ORDER[m.category], render: (m) => <CategoryBadge category={m.category} /> },
  { key: 'program', header: 'Program', sortValue: (m) => m.program, render: (m) => m.program },
  { key: 'direction', header: 'Better', render: (m) => (m.direction === 'lower_better' ? 'Lower' : 'Higher') },
]

export default function Methods() {
  const nat = useData(loadNational)
  const meas = useData(loadMeasures)
  const p = nat.status === 'ready' ? nat.data.hac_params : null
  const fy = p?.fiscal_year ?? 2026

  return (
    <div>
      <PageHeader
        eyebrow="Methodology"
        title="How CareSignal calculates every number"
        description="Plain-English methods with the exact formulas. Every figure on this site comes from public CMS files through the steps below, and the HAC rebuild is checked against CMS's official scores on every build."
      />
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24"><Toc items={SECTIONS} /></div>
        </aside>
        <article className="min-w-0 max-w-4xl space-y-8">
          <Section id="overview" title="Overview">
            <p>
              Medicare adjusts hospital payments through three quality programs: the <strong>Hospital-Acquired Condition (HAC) Reduction Program</strong>,
              <strong> Hospital Value-Based Purchasing (VBP)</strong> and the <strong>Hospital Readmissions Reduction Program (HRRP)</strong>.
              CareSignal turns the published scores into three answers a nursing leader can act on. How close is the hospital to the HAC penalty line?
              Which nursing-sensitive measure drives that? How many patient harms would need to be prevented to get clear?
            </p>
            <p>
              The pipeline downloads each CMS file through the Provider Data Catalog metastore and validates it against a documented rule set
              (see <Link to="/data-quality" className="font-medium text-primary hover:underline">Data quality</Link>). It then rebuilds the HAC score and precomputes every metric.
              The site is static, so each number traces back to a versioned build artifact.
            </p>
          </Section>

          <Section id="hac" title={`HAC score rebuild (FY${fy} CMS methodology)`}>
            <p>The Total HAC Score combines six measures. CareSignal recalculates it from the measure values in the official file.</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li><strong>Inputs.</strong> The CMS PSI 90 composite value, plus the standardized infection ratios (SIRs) for CLABSI, CAUTI, SSI (colon and abdominal hysterectomy), MRSA bacteremia and C. difficile.</li>
              <li><strong>Winsorize</strong> each measure at the 5th and 95th percentiles. These are calculated across all subsection (d) hospitals with a result, including Maryland.</li>
              <li><strong>Standardize</strong> each Winsorized value to a z-score using the mean and standard deviation of the Winsorized values. A higher z means worse performance.</li>
              <li><strong>Weight equally</strong> across the measures the hospital has. With six measures each weighs 1/6; with five, 1/5; a measure with no result gets no weight.</li>
              <li><strong>Sum</strong> the weighted z-scores to get the Total HAC Score.</li>
              <li><strong>Cutoff.</strong> This is the 75th percentile of Total HAC Scores among non-Maryland hospitals with a score. Hospitals above it receive a 1% reduction on all Medicare FFS discharges for the fiscal year.</li>
            </ol>
            <Formula label="Per-measure Winsorization and standardization">
{`w(m) = min( max( value(m), P5(m) ), P95(m) )
z(m) = ( w(m) − mean(w(m)) ) / SD(w(m))`}
            </Formula>
            <Formula label="Equal weighting across the k measures a hospital has (k ≤ 6)">
{`weight = 1 / k
Total HAC Score = Σ  weight × z(m)
penalized  ⇔  Total HAC Score > cutoff (75th percentile)`}
            </Formula>
            <p>
              <strong>Validation.</strong> The rebuilt z-scores, totals and penalty flags are compared with the official values in the CMS file on every build.
              The match rate is published on the <Link to="/data-quality" className="font-medium text-primary hover:underline">Data quality</Link> page, and a build that falls below
              tolerance is not deployed.
            </p>
          </Section>

          <Section id="parameters" title={`FY${fy} parameters used`}>
            <p>These values are recalculated from the official file on each build. The browser what-if simulator uses the same values.</p>
            {nat.status === 'loading' && <StateView kind="loading" />}
            {nat.status === 'error' && <StateView kind="error" message="Parameters could not be loaded." />}
            {p && (
              <>
                <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-md border border-border bg-surface px-4 py-3 text-sm">
                  <div><span className="text-muted">Penalty cutoff (75th pct): </span><strong className="tabular">{fmt(p.cutoff, 4)}</strong></div>
                  <div><span className="text-muted">“Near” band: </span><strong>≤{p.near_band} added infections</strong></div>
                </div>
                <ParamsTable p={p} />
                <SourceNote>CMS HAC Reduction Program FY{p.fiscal_year} (yq43-i98g), as calculated by the CareSignal pipeline</SourceNote>
              </>
            )}
          </Section>

          <Section id="ptp" title="Patients-to-prevent">
            <p>
              CMS publishes z-scores and SIRs. CareSignal turns the distance to the cutoff into <strong>patients</strong>: the number of infections that would need to be
              prevented in one measure to bring the hospital below the line. The calculation runs for each infection measure:
            </p>
            <Formula label="For hospital h and HAI measure m">
{`Δ      = TotalHAC(h) − cutoff                    (if Δ ≤ 0 the hospital is clear → show cushion)
Δz     = Δ / weight(h)                           (z-score change needed in measure m alone)
ΔSIR   = Δz × SD(m)                              (re-checked against the Winsorization floor)
events = ⌈ ΔSIR × Predicted(m) ⌉                 (SIR = Observed / Predicted)`}
            </Formula>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>The <strong>tipping measure</strong> is the one that needs the fewest prevented events to clear the cutoff.</li>
              <li>If the hospital's value is above the 95th-percentile cap, the first reductions only bring it down to the cap and do not change its z-score. CareSignal counts those reductions too.</li>
              <li>If reaching the cutoff would take a measure below its 5th-percentile floor, that measure alone cannot clear the line, and it is marked <em>not feasible</em>.</li>
              <li>PSI 90 is a risk-adjusted composite rate rather than an event count, so CareSignal shows the composite change needed but no event count.</li>
              <li><strong>For hospitals that are clear</strong>, the same math run in reverse gives the <em>cushion</em>: how many added infections would push the hospital over the cutoff.</li>
            </ul>
            <p className="rounded-md border-l-4 border-warning bg-warning/5 px-4 py-3 text-sm">
              <strong>Approximate by design.</strong> The calculation holds peer performance and the cutoff constant, but both move every fiscal year.
              The official HAC file has no predicted infection counts, so the program-year view uses predicted counts from the current HAI file as a proxy.
            </p>
          </Section>

          <Section id="views" title="Program year vs current trajectory">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-4">
                <dt className="font-semibold">Program year view</dt>
                <dd className="mt-1 text-sm text-muted">
                  Uses the official FY{fy} HAC file: PSI 90 for 07/01/2022–06/30/2024 and HAI measures for 01/01/2023–12/31/2024.
                  This is the period that actually determined the FY{fy} penalty.
                </dd>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <dt className="font-semibold">Current trajectory view</dt>
                <dd className="mt-1 text-sm text-muted">
                  Uses the latest HAI file (currently 10/01/2024–09/30/2025) scored against the FY{fy} distribution and cutoff as a proxy.
                  It is an early warning for upcoming program years, not a forecast of an actual penalty.
                </dd>
              </div>
            </dl>
            <p>Both SSI SIRs (colon and abdominal hysterectomy) are combined into one SIR as pooled observed over pooled predicted, matching the single SSI measure in the HAC program.</p>
          </Section>

          <Section id="status" title="Status definitions">
            <dl className="space-y-2">
              <div><dt className="inline font-semibold text-critical">Penalized: </dt><dd className="inline">CMS flagged the hospital for the FY2026 payment reduction (its Total HAC Score is above the cutoff).</dd></div>
              <div><dt className="inline font-semibold text-warning">Near cutoff: </dt><dd className="inline">Not penalized, but the smallest cushion across HAI measures is {p?.near_band ?? 2} or fewer added infections.</dd></div>
              <div><dt className="inline font-semibold text-ok">Clear: </dt><dd className="inline">Below the cutoff with a larger cushion.</dd></div>
              <div><dt className="inline font-semibold text-muted">Exempt (Maryland): </dt><dd className="inline">Maryland hospitals receive a Total HAC Score, but CMS waives the HAC payment reduction under the Maryland All-Payer Model (CMS footnote a). They are included in the Winsorization distributions, but excluded from the cutoff and from every penalty rate on this site.</dd></div>
              <div><dt className="inline font-semibold text-muted">No HAC score: </dt><dd className="inline">The hospital is not in the HAC program file or has no Total HAC Score. Examples include critical access hospitals and hospitals with too few measures.</dd></div>
            </dl>
            <h3 className="pt-2 font-semibold text-ink">Why so many hospitals are &ldquo;near&rdquo; the cutoff</h3>
            <p>
              A Standardized Infection Ratio is observed infections divided by predicted infections. Many hospitals have a predicted count of only one to three
              infections for a measure over the HAI period. At that size, one additional infection can move the SIR by 0.3 to 1.0. After standardization, that is
              often enough to move the Total HAC Score across the cutoff. This sensitivity comes from how the CMS HAC Reduction Program scores small denominators,
              not from CareSignal. For hospitals near the line, the penalty can turn on a single event, and the confidence intervals in the HAI table are wide.
            </p>
          </Section>

          <Section id="nursing" title="Nursing-sensitive measure map">
            <p>
              Each measure is tagged so nursing leaders can see the part of the score they directly influence. The categories are an informed judgment, and the rationale is published for each one.
            </p>
            <ul className="flex flex-wrap gap-3 text-sm">
              {(['nursing', 'shared', 'other'] as Category[]).map((c) => (
                <li key={c} className="flex items-center gap-2"><CategoryBadge category={c} />
                  <span className="text-muted">{c === 'nursing' ? 'Nursing practice is the primary driver' : c === 'shared' ? 'Nursing shares ownership with another team' : 'Mainly driven by other disciplines'}</span>
                </li>
              ))}
            </ul>
            {meas.status === 'loading' && <StateView kind="loading" />}
            {meas.status === 'error' && <StateView kind="error" message="The measure dictionary could not be loaded." />}
            {meas.status === 'ready' && (
              <SortableTable caption="Measure dictionary with nursing category and rationale" rows={meas.data.measures} columns={measureCols}
                rowKey={(m) => m.id} initialSort="category" initialDir="asc" maxHeight={560} />
            )}
            <SourceNote>CareSignal measure map (config/measure_map.yaml); measure definitions from CMS</SourceNote>
          </Section>

          <Section id="peers" title="Peer groups">
            <p>Peers are defined by transparent rules rather than black-box clustering, and named competitors are never shown.</p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">Peer group dimensions</caption>
                <tbody>
                  {[
                    ['Bed size', '<100 · 100–299 · 300–499 · 500+ (Hospital Provider Cost Report)'],
                    ['Teaching', 'None (0 resident FTEs) · Minor (resident FTE-to-bed ratio below 0.25) · Major (0.25 or above)'],
                    ['Location', 'Urban / rural (cost report designation)'],
                    ['Region', 'The four U.S. Census regions, derived from state; territories are grouped separately'],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-border/60 first:border-0">
                      <th scope="row" className="w-32 bg-surface-2 px-3 py-2 text-left font-medium">{k}</th>
                      <td className="px-3 py-2">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>A peer group needs at least 15 hospitals with a HAC score. Smaller groups fall back to bed size and teaching status only, and the hospital page says when a fallback is used.</p>
          </Section>

          <Section id="hcahps" title="HCAHPS and readmissions">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Nurse communication</strong> uses the HCAHPS top-box share: the percent of patients answering “Always” (<code className="font-mono text-[13px]">H_COMP_1_A_P</code>).
                CareSignal shows it as a percentile against peers, the state and the nation, alongside the nurse respect, listen and explain items and discharge information.
              </li>
              <li>
                <strong>Readmissions.</strong> The HRRP excess readmission ratio (ERR) is predicted readmissions divided by expected readmissions, reported per condition.
                Values above 1.0 mean more readmissions than expected for a hospital with the same patients and are highlighted.
              </li>
              <li>
                <strong>The VBP simulator shows percentiles, not points.</strong> The what-if panel shows the hospital's percentile after a gain of a given number of top-box points.
                VBP achievement and improvement thresholds come from separate files, so the tool does not reproduce exact VBP points.
              </li>
            </ul>
          </Section>

          <Section id="exposure" title="Dollar exposure (estimate)">
            <Formula label="Order-of-magnitude estimate">
{`Exposure ≈ 1% × total Medicare inpatient payments   (Medicare Inpatient Hospitals – by Provider)`}
            </Formula>
            <p>
              This shows the scale of what is at stake. It is not a claim about the hospital's actual reduction, which applies to fee-for-service base operating DRG payments
              and depends on case mix and payment add-ons.
            </p>
          </Section>

          <Section id="limitations" title="Limitations">
            <ul className="space-y-3">
              {LIMITATIONS.map((l) => (
                <li key={l.title}>
                  <p className="font-semibold">{l.title}</p>
                  <p className="text-sm text-muted">{l.body}</p>
                </li>
              ))}
            </ul>
          </Section>
        </article>
      </div>
    </div>
  )
}
