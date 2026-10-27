import { useState, type ReactNode } from 'react'
import { CategoryBadge, StateView } from '../components/ui'
import { Formula } from '../components/insights/Formula'
import { SortableTable, type Column } from '../components/insights/SortableTable'
import { GLOSSARY, LIMITATIONS } from '../components/insights/content'
import { Accordion, ArrowLink, BlockButton, PageIntro, ShowMath, Source } from '../components/insights/layout'
import { loadMeasures, loadNational, useData } from '../lib/data'
import { CATEGORY_LABEL, HAC_LABELS, fmt, fmtInt } from '../lib/format'
import type { Category, HacMeasureKey, HacParams, MeasureDef } from '../lib/types'

const BASE = import.meta.env.BASE_URL
const MEASURE_ORDER: HacMeasureKey[] = ['psi90', 'clabsi', 'cauti', 'ssi', 'cdi', 'mrsa']
const CAT_ORDER: Record<Category, number> = { nursing: 0, shared: 1, other: 2 }
const CAT_MEANING: Record<Category, string> = {
  nursing: 'Daily nursing care is the main driver',
  shared: 'Nursing shares ownership with another team',
  other: 'Mostly driven by other teams, such as surgery',
}

const measureCols: Column<MeasureDef>[] = [
  {
    key: 'label', header: 'Measure and why it is grouped this way', sortValue: (m) => m.label,
    render: (m) => (
      <div className="max-w-md whitespace-normal">
        <div className="font-semibold text-ink">{m.label}</div>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{m.rationale}</p>
      </div>
    ),
  },
  { key: 'category', header: 'Group', sortValue: (m) => CAT_ORDER[m.category], render: (m) => <CategoryBadge category={m.category} /> },
  { key: 'program', header: 'Program', sortValue: (m) => m.program, render: (m) => m.program },
  { key: 'direction', header: 'Better when', render: (m) => (m.direction === 'lower_better' ? 'Lower' : 'Higher') },
]

function ParamsTable({ p }: { p: HacParams }) {
  return (
    <div className="mt-3 overflow-x-auto border border-border">
      <table className="w-full min-w-max text-sm">
        <caption className="sr-only">FY{p.fiscal_year} limits, average and spread used for each measure</caption>
        <thead className="bg-surface-2">
          <tr>
            {['Measure', 'Lowest value counted', 'Highest value counted', 'Average', 'Spread', 'Hospitals'].map((h, i) => (
              <th key={h} scope="col" className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink ${i ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MEASURE_ORDER.map((k) => {
            const m = p.measures[k]
            if (!m) return null
            return (
              <tr key={k} className="border-t border-border/60 text-ink">
                <th scope="row" className="px-3 py-2 text-left font-semibold">{HAC_LABELS[k]}</th>
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

function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="mt-2 space-y-4">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-navy-ink">{i + 1}</span>
          <div>
            <p className="font-bold text-ink">{s.title}</p>
            <div className="mt-0.5">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function Methods() {
  const nat = useData(loadNational)
  const meas = useData(loadMeasures)
  const p = nat.status === 'ready' ? nat.data.hac_params : null
  const fy = p?.fiscal_year ?? 2026
  const near = p?.near_band ?? 2
  const [allOpen, setAllOpen] = useState(0)

  return (
    <div>
      <PageIntro
        eyebrow="How it works"
        title="How we calculate every number"
        lead="CareSignal uses only public data from the Centers for Medicare and Medicaid Services (CMS). We rebuild the official safety score ourselves, check it against CMS results, and then turn it into numbers a care team can act on."
        tells="What the safety score is, how the penalty line works, how we count infections to prevent, how we choose similar hospitals, and what this tool cannot tell you. Open any section below. The math is there for anyone who wants it, behind a Show the math button."
        actions={<>
          <BlockButton variant="navy" onClick={() => window.print()}>Print this page</BlockButton>
          <BlockButton variant="navy" href={`${BASE}downloads/CareSignal_Workbook.xlsx`} download>Download the data</BlockButton>
        </>}
      />

      <div className="no-print mb-4 flex justify-end">
        <button type="button" onClick={() => setAllOpen((x) => x + 1)}
          className="rounded-[2px] bg-navy px-4 py-2 text-sm font-bold text-navy-ink hover:opacity-90">Show all</button>
      </div>

      <div key={allOpen} className="space-y-5">
        <Accordion id="score" title="How the safety score works" defaultOpen>
          <p>
            Medicare gives each hospital one safety score, officially called the Total HAC Score (HAC stands for hospital acquired conditions).
            It combines six kinds of harm that can happen to patients while they are in the hospital:
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {MEASURE_ORDER.map((k) => <li key={k} className="flex gap-2"><span aria-hidden className="text-primary">●</span>{HAC_LABELS[k]}</li>)}
          </ul>
          <Steps items={[
            { title: 'Compare each measure to other hospitals', body: 'For each type of harm we see how far the hospital is from the national average. Extreme values are trimmed to the top and bottom 5% so one unusual hospital cannot distort the comparison.' },
            { title: 'Put every measure on the same scale', body: 'Each measure becomes points above or below average. Above average means more harm than typical.' },
            { title: 'Average the measures the hospital has', body: 'Every measure counts equally. If CMS has no result for a measure, it is left out rather than counted as zero.' },
            { title: 'Compare with the penalty line', body: `The worst quarter of hospitals is above the penalty line${p ? ` (a score of ${fmt(p.cutoff, 2)} for FY${fy})` : ''}. Those hospitals lose 1% of their Medicare payments for the year.` },
          ]} />
          <p className="mt-4">
            <strong className="text-ink">We check our work.</strong> Our rebuilt scores are compared with the official CMS file every time the site updates.
            The results are on the <ArrowLink to="/data-quality">About the data</ArrowLink> page. If the check fails, the update is not published.
          </p>
          <ShowMath>
            <Formula label="For each measure m: trim to the 5th and 95th percentiles, then standardize">
{`trimmed(m) = min( max( value(m), P5(m) ), P95(m) )
points(m)  = ( trimmed(m) − average(m) ) / spread(m)`}
            </Formula>
            <Formula label="Average over the k measures the hospital has (k is 6 or fewer)">
{`safety score = sum of points(m) / k
above the penalty line when safety score > 75th percentile of all scores`}
            </Formula>
            {nat.status === 'loading' && <StateView kind="loading" />}
            {p && (
              <>
                <p className="mt-3 text-sm">The values CMS used for FY{fy}. The what if simulator on each hospital page uses the same numbers.</p>
                <ParamsTable p={p} />
                <Source>CMS Hospital Acquired Condition Reduction Program, FY{p.fiscal_year}, as recalculated by CareSignal</Source>
              </>
            )}
          </ShowMath>
        </Accordion>

        <Accordion id="status" title="What the labels mean" defaultOpen={allOpen > 0}>
          <dl className="space-y-3">
            <div><dt className="font-bold text-critical">Above the penalty line</dt><dd>CMS cut this hospital's Medicare payments by 1% for FY{fy}.</dd></div>
            <div><dt className="font-bold text-warning">Close to the line</dt><dd>Below the line, but {near} or fewer extra infections of one type would push it over.</dd></div>
            <div><dt className="font-bold text-ok">Below the line</dt><dd>Safely below the penalty line.</dd></div>
            <div><dt className="font-bold text-ink">Exempt (Maryland)</dt><dd>Maryland hospitals get a safety score, but the state's own Medicare agreement means they are never penalized. We leave them out of every penalty count.</dd></div>
            <div><dt className="font-bold text-ink">No safety score</dt><dd>CMS did not score this hospital. This is common for small rural critical access hospitals and hospitals with too few cases.</dd></div>
          </dl>
          <h3 className="mt-5 font-bold text-ink">Why so many hospitals are close to the line</h3>
          <p className="mt-1">
            Many hospitals expect only one to three infections of a given type over two years. At that size a single extra case changes the infection rate a lot,
            which can be enough to move the safety score across the line. This comes from how CMS scores small numbers, not from our tool.
          </p>
          <h3 className="mt-5 font-bold text-ink">Why our count differs slightly from CMS</h3>
          <p className="mt-1">
            CMS flagged {nat.status === 'ready' ? fmtInt(nat.data.counts.official_flagged) : 'a few more'} hospitals.
            A few of them have no published score or are missing from the CMS hospital list, so they have no profile here.
          </p>
        </Accordion>

        <Accordion id="prevent" title="How we count infections to prevent" defaultOpen={allOpen > 0}>
          <p>
            CMS publishes scores, not patients. We turn the distance to the penalty line into a number of infections: how many fewer infections of one type
            would bring the hospital below the line, if everything else stayed the same.
          </p>
          <Steps items={[
            { title: 'Measure the gap', body: 'How far is the hospital’s safety score above the penalty line?' },
            { title: 'Find the change needed in one measure', body: 'How much would one infection rate need to drop to close that gap on its own?' },
            { title: 'Turn the rate into infections', body: 'Multiply by the number of infections CMS expected at that hospital, then round up to whole infections.' },
            { title: 'Pick the biggest opportunity', body: 'The infection type that needs the fewest prevented cases is highlighted on the hospital page.' },
          ]} />
          <ul className="mt-4 list-disc space-y-1.5 pl-5">
            <li>If a hospital is below the line, we run the same math in reverse to show its cushion: how many extra infections would push it over.</li>
            <li>Some measures cannot close the gap alone because they are already as low as CMS counts. We say so instead of showing a number.</li>
            <li>Patient safety events are a combined rate, not a count of cases, so we do not show a number of events for them.</li>
          </ul>
          <p className="mt-4 border-l-4 border-warning bg-surface-2 px-4 py-3">
            <strong className="text-ink">This is an estimate.</strong> It assumes other hospitals and the penalty line stay the same, but both change every year.
            The official file does not include expected infection counts, so we use the counts from the most recent CMS infection file.
          </p>
          <h3 className="mt-5 font-bold text-ink">Two time periods</h3>
          <dl className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-surface-2 p-4">
              <dt className="font-bold text-ink">Penalty year view</dt>
              <dd className="mt-1 text-sm">The official FY{fy} results. This is the data that decided this year's penalty (care from 2022 to 2024).</dd>
            </div>
            <div className="bg-surface-2 p-4">
              <dt className="font-bold text-ink">Recent trend view</dt>
              <dd className="mt-1 text-sm">The newest infection data (care from late 2024 to late 2025) scored with this year's rules. An early warning, not a prediction.</dd>
            </div>
          </dl>
          <ShowMath>
            <Formula label="For hospital h and infection type m">
{`gap         = safety score(h) − penalty line        (if 0 or less, show the cushion instead)
points drop = gap × number of measures(h)
rate drop   = points drop × spread(m)               (checked against the lowest value counted)
infections  = round up( rate drop × expected infections(m) )
infection rate = infections seen / infections expected`}
            </Formula>
          </ShowMath>
        </Accordion>

        <Accordion id="peers" title="How we pick similar hospitals" defaultOpen={allOpen > 0}>
          <p>We compare each hospital with others like it, using simple rules anyone can check. We never name or rank competitors.</p>
          <div className="mt-3 overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">How similar hospitals are grouped</caption>
              <tbody>
                {[
                  ['Size', 'Fewer than 100 beds, 100 to 299, 300 to 499, or 500 and more'],
                  ['Teaching role', 'None, minor or major, based on the number of doctors in training per bed'],
                  ['Setting', 'City or rural, based on where the hospital is located'],
                  ['Region', 'Northeast, Midwest, South or West (U.S. territories are grouped separately)'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-t border-border/60 first:border-0">
                    <th scope="row" className="w-36 bg-surface-2 px-3 py-2.5 text-left font-bold text-ink">{k}</th>
                    <td className="px-3 py-2.5 text-ink">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3">A group needs at least 15 hospitals with a safety score. If it has fewer, we use size and teaching role only, and the hospital page says so.</p>
          <Source>Hospital size and teaching role come from the CMS Hospital Cost Report.</Source>
        </Accordion>

        <Accordion id="nursing" title="Which team owns each measure" defaultOpen={allOpen > 0}>
          <p>We label every measure so nurse leaders can see which part of the score their teams influence most. Each label comes with a short reason.</p>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-5">
            {(['nursing', 'shared', 'other'] as Category[]).map((c) => (
              <li key={c} className="flex items-center gap-2"><CategoryBadge category={c} /><span className="text-sm">{CAT_MEANING[c]}</span></li>
            ))}
          </ul>
          <div className="mt-4">
            {meas.status === 'loading' && <StateView kind="loading" />}
            {meas.status === 'error' && <StateView kind="error" message="The measure list could not be loaded." />}
            {meas.status === 'ready' && (
              <SortableTable caption="Every measure with its group and the reason" rows={meas.data.measures} columns={measureCols}
                rowKey={(m) => m.id} initialSort="category" initialDir="asc" maxHeight={560} />
            )}
          </div>
          <Source>CareSignal measure list; measure definitions from CMS</Source>
        </Accordion>

        <Accordion id="experience" title="Patient experience and readmissions" defaultOpen={allOpen > 0}>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-ink">Nurse communication score.</strong> The percent of surveyed patients who said nurses <em>always</em> listened carefully,
              explained things clearly and treated them with respect. We show how the hospital ranks against similar hospitals, its state and the nation.
            </li>
            <li>
              <strong className="text-ink">Readmission ratio.</strong> Patients who came back to a hospital within 30 days, compared with how many were expected for
              a hospital with similar patients. Above 1.0 means more than expected, and we highlight it.
            </li>
            <li>
              <strong className="text-ink">We show rankings, not payment points.</strong> Medicare's value based purchasing program turns these scores into points
              using extra thresholds we do not have, so the simulator shows where the hospital would rank instead.
            </li>
          </ul>
        </Accordion>

        <Accordion id="money" title="Money at risk" defaultOpen={allOpen > 0}>
          <p>
            To show the scale of what is at stake, we take 1% of the hospital's total Medicare inpatient payments. This is a rough estimate.
            The real penalty applies to a narrower set of base payments, so the true amount is usually lower.
          </p>
          <ShowMath>
            <Formula label="Rough estimate">{`money at risk = 1% × total Medicare inpatient payments (CMS Medicare Inpatient Hospitals by Provider)`}</Formula>
          </ShowMath>
        </Accordion>

        <Accordion id="limits" title="What this tool cannot tell you" defaultOpen={allOpen > 0}>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LIMITATIONS.map((l) => (
              <li key={l.title} className="bg-surface-2 p-4">
                <p className="font-bold text-ink">{l.title}</p>
                <p className="mt-1 text-sm">{l.body}</p>
              </li>
            ))}
          </ul>
        </Accordion>

        <Accordion id="glossary" title="Glossary" defaultOpen={allOpen > 0}>
          <p>We use plain names on this site. The official CMS name is listed so you can match it to CMS reports.</p>
          <div className="mt-3 overflow-x-auto border border-border">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Plain names, official names and meanings</caption>
              <thead className="bg-surface-2">
                <tr>
                  {['We say', 'CMS calls it', 'What it means'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ink">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GLOSSARY.map((g) => (
                  <tr key={g.plain} className="border-t border-border/60 align-top">
                    <th scope="row" className="px-3 py-2.5 text-left font-bold text-ink">{g.plain}</th>
                    <td className="px-3 py-2.5 text-muted">{g.tech}</td>
                    <td className="px-3 py-2.5 text-ink">{g.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm">Group names used on this site: {(['nursing', 'shared', 'other'] as Category[]).map((c) => CATEGORY_LABEL[c]).join(', ')}.</p>
        </Accordion>
      </div>
    </div>
  )
}
