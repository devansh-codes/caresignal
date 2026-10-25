import { Link } from 'react-router-dom'
import { SearchBar } from '../components/search/SearchBar'
import { Card, CategoryBadge, KpiTile, SourceNote, StateView, StatusPill } from '../components/ui'
import { loadIndex, loadManifest, loadNational, useData } from '../lib/data'
import { fmt, fmtDate, fmtInt, fmtPct, fmtSigned, HAC_EVENT_NOUN, HAC_LABELS } from '../lib/format'
import type { Category, HacStatus, IndexEntry, Manifest, National } from '../lib/types'

const HAC_SOURCE = 'CMS HAC Reduction Program, FY2026 (yq43-i98g)'

function hacFreshness(manifest: Manifest | null) {
  const m = manifest?.sources.find((s) => s.id === 'yq43-i98g')
  return m?.modified ? ` · updated ${fmtDate(m.modified)}` : ''
}

export default function Home() {
  const national = useData(loadNational)
  const manifest = useData(loadManifest)
  const index = useData(loadIndex)
  const man = manifest.status === 'ready' ? manifest.data : null

  return (
    <div className="space-y-10">
      <Hero />

      <section aria-labelledby="kpi-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="kpi-heading" className="text-lg font-semibold text-ink">
            FY2026 HAC Reduction Program at a glance
          </h2>
          <Link to="/insights" className="text-sm font-medium text-primary hover:underline">
            All national insights →
          </Link>
        </div>
        {national.status === 'loading' && <StateView kind="loading" />}
        {national.status === 'error' && <StateView kind="error" message="National figures could not be loaded." />}
        {national.status === 'ready' && <NationalKpis n={national.data} freshness={hacFreshness(man)} />}
      </section>

      {national.status === 'ready' && national.data.insights.length > 0 && (
        <section aria-labelledby="insights-heading">
          <h2 id="insights-heading" className="mb-3 text-lg font-semibold text-ink">
            Headline findings
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {national.data.insights.slice(0, 3).map((ins) => (
              <Card key={ins.id} className="flex flex-col">
                <div className="text-sm font-medium text-muted">{ins.title}</div>
                <div className="tabular mt-1 text-2xl font-semibold text-ink">{ins.value}</div>
                <p className="mt-2 flex-1 text-sm text-muted">{ins.detail}</p>
                <SourceNote>
                  {ins.source} · {ins.period}
                </SourceNote>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section aria-labelledby="examples-heading" className="lg:col-span-3">
          <Card
            title={<span id="examples-heading">Start with an example hospital</span>}
            subtitle="One hospital from each FY2026 status group, chosen alphabetically from the data."
          >
            {index.status === 'loading' && <StateView kind="loading" />}
            {index.status === 'error' && <StateView kind="error" message="Hospital list could not be loaded." />}
            {index.status === 'ready' && <Examples entries={index.data} />}
          </Card>
        </section>
        <section aria-labelledby="lens-heading" className="lg:col-span-2">
          <NursingLens />
        </section>
      </div>

      <HowItWorks />
    </div>
  )
}

function Hero() {
  return (
    <section className="rounded-card border border-border bg-surface px-5 py-10 sm:px-10 sm:py-14">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
          Nursing-sensitive quality &amp; CMS penalty radar
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-4xl">
          How close is your hospital to a Medicare quality penalty — and how many patients would change that?
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted sm:text-base">
          CareSignal turns CMS z-scores and Standardized Infection Ratios into patients: the number of CAUTIs, CLABSIs
          and other harms that stand between a hospital and the HAC Reduction Program cutoff.
        </p>
        <div className="mx-auto mt-7 max-w-2xl text-left">
          <SearchBar size="lg" label="Search for a hospital" />
          <p className="mt-2 text-center text-xs text-muted">
            Covers every facility in CMS Hospital General Information. Or{' '}
            <Link to="/hospitals" className="font-medium text-primary hover:underline">
              browse the full directory
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}

function NationalKpis({ n, freshness }: { n: National; freshness: string }) {
  const { counts, hac_params } = n
  const eligible = counts.hac_scored - counts.exempt
  const penalizedPct = eligible ? (counts.penalized / eligible) * 100 : null
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Hospitals with a Total HAC Score"
          value={fmtInt(counts.hac_scored)}
          context={`of ${fmtInt(counts.facilities)} facilities in CMS Hospital General Information`}
          source={`${HAC_SOURCE}${freshness}`}
        />
        <KpiTile
          label="Penalized: 1% payment reduction"
          value={fmtInt(counts.penalized)}
          tone="critical"
          context={`${fmtPct(penalizedPct, 1)} of program-eligible scored hospitals (worst-performing quartile)`}
          info={`Hospitals CMS flagged for the 1% reduction on all Medicare FFS discharges and profiled in Hospital General Information. CMS flagged ${fmtInt(counts.official_flagged)} in total; ${fmtInt(counts.exempt)} Maryland hospitals are scored but waived.`}
          source={`${HAC_SOURCE}${freshness}`}
        />
        <KpiTile
          label="Clear but near the cutoff"
          value={fmtInt(counts.near)}
          tone="warning"
          context={`within ≤${hac_params.near_band} added infections in one measure of crossing`}
          info="Not penalized, but the smallest number of additional infections in any single HAI measure that would push the Total HAC Score above the cutoff is at most the near band. Holds peers and the cutoff constant."
          source={`CareSignal calculation on ${HAC_SOURCE} and CMS HAI file (77hc-ibv8)`}
        />
        <KpiTile
          label={`FY${hac_params.fiscal_year} penalty cutoff`}
          value={fmt(hac_params.cutoff, 4)}
          context="Total HAC Score at the 75th percentile; higher = worse"
          info="75th percentile of Total HAC Scores among non-Maryland subsection (d) hospitals with a score. The cutoff moves every program year."
          source={`${HAC_SOURCE}${freshness}`}
        />
      </div>
      <StatusBar counts={counts} />
    </>
  )
}

/** Share of all facilities by FY2026 status, as one labeled proportion bar (not color alone). */
function StatusBar({ counts }: { counts: National['counts'] }) {
  const noScore = Math.max(counts.facilities - counts.hac_scored, 0)
  const segs: { status: HacStatus; n: number; cls: string; label: string }[] = [
    { status: 'penalized', n: counts.penalized, cls: 'bg-critical', label: 'Penalized' },
    { status: 'near', n: counts.near, cls: 'bg-warning', label: 'Near cutoff' },
    { status: 'clear', n: counts.clear, cls: 'bg-ok', label: 'Clear' },
    { status: 'exempt', n: counts.exempt, cls: 'bg-other', label: 'Exempt (Maryland)' },
    { status: 'no_score', n: noScore, cls: 'bg-other/40', label: 'No HAC score' },
  ]
  const total = segs.reduce((a, s) => a + s.n, 0)
  if (!total) return null
  return (
    <div className="mt-4 rounded-card border border-border bg-surface p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">All facilities by FY2026 HAC status</div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={segs.map((s) => `${s.label}: ${fmtInt(s.n)}`).join(', ')}>
        {segs.filter((s) => s.n > 0).map((s) => (
          <div key={s.status} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} title={`${s.label}: ${fmtInt(s.n)}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {segs.map((s) => (
          <li key={s.status}>
            <Link to={`/hospitals?status=${s.status}`} className="inline-flex items-center gap-2 hover:underline">
              <StatusPill status={s.status} />
              <span className="tabular font-medium text-ink">{fmtInt(s.n)}</span>
              <span className="tabular text-muted">({fmtPct((s.n / total) * 100, 1)})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Examples({ entries }: { entries: IndexEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name))
  const picks = (['penalized', 'near', 'clear'] as HacStatus[])
    .map((st) => sorted.find((e) => e.status === st && e.hac != null))
    .filter((e): e is IndexEntry => !!e)
  if (!picks.length) return <StateView kind="empty" message="No scored hospitals are available yet." />
  return (
    <ul className="divide-y divide-border">
      {picks.map((e) => (
        <li key={e.ccn}>
          <Link
            to={`/hospital/${e.ccn}`}
            className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{e.name}</span>
              <span className="block text-xs text-muted">
                {e.city}, {e.state} · Total HAC {fmt(e.hac, 4)} · gap {fmtSigned(e.gap, 4)}
                {e.tip && e.status === 'penalized' && (
                  <> · ~{e.tip.events} fewer {HAC_EVENT_NOUN[e.tip.measure][e.tip.events === 1 ? 0 : 1]} to clear</>
                )}
              </span>
            </span>
            <StatusPill status={e.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

const LENS: { category: Category; text: string; examples: string }[] = [
  {
    category: 'nursing',
    text: 'Outcomes nursing practice directly drives at the bedside.',
    examples: `${HAC_LABELS.cauti}, ${HAC_LABELS.clabsi}, pressure injury (PSI 03), falls with hip fracture (PSI 08), HCAHPS nurse communication`,
  },
  {
    category: 'shared',
    text: 'Outcomes nursing shapes together with infection prevention, EVS, pharmacy or case management.',
    examples: 'C. difficile, MRSA bacteremia, discharge information, readmissions, SEP-1',
  },
  {
    category: 'other',
    text: 'Measures driven mainly by surgical, physician or system processes.',
    examples: 'Surgical site infections, surgical PSI components, physician communication',
  },
]

function NursingLens() {
  return (
    <Card
      title={<span id="lens-heading">The nursing lens</span>}
      subtitle="Every measure carries a badge so nursing leaders can see what they own."
      className="h-full"
    >
      <ul className="space-y-4">
        {LENS.map((l) => (
          <li key={l.category}>
            <CategoryBadge category={l.category} />
            <p className="mt-1 text-sm text-ink">{l.text}</p>
            <p className="text-xs text-muted">e.g. {l.examples}</p>
          </li>
        ))}
      </ul>
      <Link to="/methods" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Read the measure-map rationale →
      </Link>
    </Card>
  )
}

const STEPS = [
  {
    title: 'Locate the penalty line',
    body: 'We rebuild the FY2026 Total HAC Score from CMS measure values (winsorize, standardize, weight equally) and validate it against the official CMS file.',
  },
  {
    title: 'Find the driver',
    body: 'A waterfall shows each measure’s weighted contribution, tagged nursing-driven, shared or other, against peers of similar size, teaching status, setting and region.',
  },
  {
    title: 'Translate into patients',
    body: 'Each SIR gap becomes whole infections to prevent, using CMS predicted counts. The cheapest path is flagged as the tipping measure; a what-if simulator tests scenarios.',
  },
]

function HowItWorks() {
  return (
    <section aria-labelledby="how-heading">
      <h2 id="how-heading" className="mb-3 text-lg font-semibold text-ink">
        How it works
      </h2>
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-card border border-border bg-surface p-5">
            <span className="tabular inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <h3 className="mt-3 font-semibold text-ink">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">
        All figures are approximate: they hold peer performance and the cutoff constant, and CMS data lag 1–2 years.{' '}
        <Link to="/methods" className="font-medium text-primary hover:underline">
          Methodology
        </Link>{' '}
        ·{' '}
        <Link to="/data-quality" className="font-medium text-primary hover:underline">
          Data quality
        </Link>
      </p>
    </section>
  )
}
