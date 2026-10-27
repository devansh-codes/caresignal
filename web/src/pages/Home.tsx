import { Link } from 'react-router-dom'
import { SearchBar } from '../components/search/SearchBar'
import { TEAL_SCALE } from '../components/charts/theme'
import { ArrowLink, Band, BigStat, CategoryBadge, EyebrowLabel, SourceNote, StateView, StatusPill, Step } from '../components/ui'
import { loadIndex, loadNational, useData } from '../lib/data'
import { fmtInt, fmtPct, HAC_EVENT_NOUN, HAC_LABELS, STATUS_LABEL, titleCase } from '../lib/format'
import type { Category, HacStatus, IndexEntry, National } from '../lib/types'

const HAC_SOURCE = 'CMS Hospital Acquired Condition Reduction Program, FY2026'

export default function Home() {
  const national = useData(loadNational)
  const index = useData(loadIndex)
  const n = national.status === 'ready' ? national.data : null

  return (
    <div className="space-y-12 sm:space-y-16">
      <Hero national={n} />

      {national.status === 'error' && <StateView kind="error" message="National figures could not be loaded. Please refresh the page." />}
      {national.status === 'loading' && <StateView kind="loading" />}
      {n && <Mission n={n} />}

      <div>
        <Band eyebrow="Getting started" title="How to use this site in 3 steps">
          <ol className="grid gap-8 md:grid-cols-3">
            <li><Step n={1} title="Find your hospital">Type its name, city or state in the search box. Every hospital Medicare lists is included.</Step></li>
            <li><Step n={2} title="Check where it stands">A colored label tells you if it is above the penalty line, close to it, or safely below it.</Step></li>
            <li><Step n={3} title="See what would change it">We show which infections matter most and roughly how many fewer cases would move the hospital below the line.</Step></li>
          </ol>
        </Band>
      </div>

      {n && <StatusOverview counts={n.counts} />}

      <div className="grid gap-10 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-rule">
        <Column title="Example hospitals" cta={{ to: '/hospitals', label: 'See all hospitals' }}>
          {index.status === 'loading' && <StateView kind="loading" />}
          {index.status === 'error' && <StateView kind="error" message="The hospital list could not be loaded." />}
          {index.status === 'ready' && <Examples entries={index.data} />}
        </Column>
        <Column title="Key facts" cta={{ to: '/insights', label: 'See all national insights' }}>
          {n ? <KeyFacts n={n} /> : <StateView kind="loading" />}
        </Column>
        <Column title="What the labels mean" cta={{ to: '/methods', label: 'Learn how it works' }}>
          <Legend />
        </Column>
      </div>
    </div>
  )
}

function Hero({ national }: { national: National | null }) {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
          See how close any hospital is to a Medicare safety penalty
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-body sm:text-xl">
          Each year Medicare cuts payments to the hospitals with the most preventable infections and injuries. CareSignal
          shows where every hospital stands, and how many fewer infections would make the difference.
        </p>
        <div className="mt-8 max-w-xl">
          <label className="mb-2 block text-sm font-bold text-royal dark:text-primary" htmlFor="hero-search-hint">Search</label>
          <SearchBar size="lg" label="Search for a hospital" />
          <p id="hero-search-hint" className="mt-3 text-sm text-body">
            Or <Link to="/hospitals" className="font-bold text-ink underline decoration-yellow decoration-2 underline-offset-4">browse the full list</Link>.
          </p>
        </div>
      </div>
      <div>{national ? <StateMap n={national} /> : <div className="aspect-[3/2] animate-pulse bg-surface-2" />}</div>
    </section>
  )
}

/** Tile grid map: one square per state, shaded by the share of scored hospitals above the penalty line. */
const GRID: Record<string, [number, number]> = {
  AK: [0, 0], ME: [10, 0], VT: [9, 1], NH: [10, 1],
  WA: [0, 2], ID: [1, 2], MT: [2, 2], ND: [3, 2], MN: [4, 2], IL: [5, 2], WI: [6, 2], MI: [7, 2], NY: [8, 2], RI: [9, 2], MA: [10, 2],
  OR: [0, 3], NV: [1, 3], WY: [2, 3], SD: [3, 3], IA: [4, 3], IN: [5, 3], OH: [6, 3], PA: [7, 3], NJ: [8, 3], CT: [9, 3],
  CA: [0, 4], UT: [1, 4], CO: [2, 4], NE: [3, 4], MO: [4, 4], KY: [5, 4], WV: [6, 4], VA: [7, 4], MD: [8, 4], DE: [9, 4],
  AZ: [1, 5], NM: [2, 5], KS: [3, 5], AR: [4, 5], TN: [5, 5], NC: [6, 5], SC: [7, 5], DC: [8, 5],
  OK: [3, 6], LA: [4, 6], MS: [5, 6], AL: [6, 6], GA: [7, 6],
  HI: [0, 7], TX: [3, 7], FL: [8, 7],
}
const BINS = [10, 15, 20, 25, 30, 35, 40, 50] // % thresholds, mapped onto the teal scale

function StateMap({ n }: { n: National }) {
  const by = new Map(n.by_state.map((s) => [s.state, s]))
  const color = (pct: number) => TEAL_SCALE[Math.min(BINS.findIndex((b) => pct < b) === -1 ? 9 : BINS.findIndex((b) => pct < b) + 1, 9)]
  const S = 40, G = 4
  return (
    <figure>
      <svg viewBox={`0 0 ${11 * (S + G)} ${8 * (S + G)}`} className="w-full" role="img"
        aria-label="Map of US states shaded by the share of hospitals above the penalty line. Darker means a higher share.">
        {Object.entries(GRID).map(([st, [c, r]]) => {
          const d = by.get(st)
          const fill = st === 'MD' ? '#D9DDE5' : d ? color(d.pct) : '#EEF1F6'
          const dark = d && st !== 'MD' && d.pct >= 30
          return (
            <g key={st} transform={`translate(${c * (S + G)},${r * (S + G)})`}>
              <title>{st === 'MD' ? 'Maryland: exempt from this penalty' : d ? `${st}: ${fmtPct(d.pct)} of ${d.n} scored hospitals above the line` : `${st}: no scored hospitals`}</title>
              <rect width={S} height={S} fill={fill} />
              <text x={S / 2} y={S / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={dark ? '#fff' : '#112659'}>{st}</text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-3 text-sm text-body">
        <div className="flex items-center gap-3">
          <span>Fewer penalized</span>
          <span className="flex h-3 flex-1" aria-hidden>
            {TEAL_SCALE.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
          </span>
          <span>More penalized</span>
        </div>
        <p className="mt-2 text-xs text-muted">Share of each state's scored hospitals above the penalty line. Maryland is gray because it is exempt. Source: {HAC_SOURCE}.</p>
      </figcaption>
    </figure>
  )
}

function Mission({ n }: { n: National }) {
  const c = n.counts
  return (
    <section className="grid gap-8 bg-surface p-6 shadow-card sm:p-12 md:grid-cols-[1.4fr_auto_1fr] md:items-center">
      <div>
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">What CareSignal does</h2>
        <p className="mt-4 text-[17px] leading-relaxed text-body">
          Medicare gives every hospital a safety score based on infections and injuries patients pick up during their stay.
          The worst quarter of hospitals lose 1% of their Medicare payments for a whole year. Many of these harms are things
          nurses help prevent every day, like catheter and central line infections. CareSignal turns the official numbers
          into plain answers: where a hospital stands, and what would move it.
        </p>
        <Link to="/methods" className="mt-7 inline-flex rounded-sm bg-yellow px-6 py-3 font-bold text-[#112659] hover:brightness-95">
          Learn more about how it works
        </Link>
      </div>
      <div className="hidden h-full w-px bg-rule md:block" aria-hidden />
      <div className="space-y-8">
        <BigStat above="Tracking" value={fmtInt(c.hac_scored)} below="hospitals with a safety score" />
        <BigStat above="This year" value={fmtInt(c.penalized)} below="are above the penalty line" tone="critical" />
      </div>
    </section>
  )
}

/** One labeled bar showing every hospital's status; each label links to the filtered list. */
function StatusOverview({ counts }: { counts: National['counts'] }) {
  const noScore = Math.max(counts.facilities - counts.hac_scored, 0)
  const segs: { status: HacStatus; n: number; cls: string }[] = [
    { status: 'penalized', n: counts.penalized, cls: 'bg-critical' },
    { status: 'near', n: counts.near, cls: 'bg-warning' },
    { status: 'clear', n: counts.clear, cls: 'bg-ok' },
    { status: 'exempt', n: counts.exempt, cls: 'bg-other' },
    { status: 'no_score', n: noScore, cls: 'bg-rule' },
  ]
  const total = segs.reduce((a, s) => a + s.n, 0)
  if (!total) return null
  return (
    <section aria-labelledby="where-heading">
      <EyebrowLabel>All {fmtInt(counts.facilities)} hospitals</EyebrowLabel>
      <h2 id="where-heading" className="mt-2 text-2xl font-bold text-ink sm:text-3xl">Where every hospital stands this year</h2>
      <div className="mt-6 bg-surface p-6 shadow-card sm:p-8">
        <div className="flex h-5 w-full gap-[2px] overflow-hidden" role="img" aria-label={segs.map((s) => `${STATUS_LABEL[s.status]}: ${fmtInt(s.n)}`).join(', ')}>
          {segs.filter((s) => s.n > 0).map((s) => (
            <div key={s.status} className={s.cls} style={{ width: `${(s.n / total) * 100}%` }} title={`${STATUS_LABEL[s.status]}: ${fmtInt(s.n)}`} />
          ))}
        </div>
        <ul className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {segs.map((s) => (
            <li key={s.status}>
              <Link to={`/hospitals?status=${s.status}`} className="group block">
                <StatusPill status={s.status} />
                <span className="tabular mt-2 block text-3xl font-light text-ink">{fmtInt(s.n)}</span>
                <span className="text-sm text-body group-hover:underline group-hover:decoration-yellow group-hover:decoration-2 group-hover:underline-offset-4">
                  {fmtPct((s.n / total) * 100, 1)} of hospitals. View list
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <SourceNote>{HAC_SOURCE}. Hospitals with no safety score are mostly small critical access, children's, psychiatric and VA hospitals, which this program does not cover.</SourceNote>
      </div>
    </section>
  )
}

function Column({ title, cta, children }: { title: string; cta: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="flex flex-col lg:px-8 lg:first:pl-0 lg:last:pr-0">
      <h2 className="mb-5 text-3xl font-bold text-ink">{title}</h2>
      <div className="flex-1 space-y-4">{children}</div>
      <Link to={cta.to} className="mt-6 block rounded-sm bg-yellow px-4 py-3 text-center font-bold text-[#112659] hover:brightness-95">
        {cta.label}
      </Link>
    </section>
  )
}

function Examples({ entries }: { entries: IndexEntry[] }) {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name))
  const picks = (['penalized', 'near', 'clear'] as HacStatus[])
    .map((st) => sorted.find((e) => e.status === st && e.hac != null))
    .filter((e): e is IndexEntry => !!e)
  if (!picks.length) return <StateView kind="empty" message="No scored hospitals are available yet." />
  return (
    <>
      {picks.map((e) => (
        <article key={e.ccn} className="bg-surface p-6 shadow-card">
          <StatusPill status={e.status} />
          <h3 className="mt-3 text-xl font-bold leading-snug text-ink">{titleCase(e.name)}</h3>
          <p className="mt-1 text-sm text-body">{titleCase(e.city)}, {e.state}</p>
          {e.tip && e.status === 'penalized' && (
            <p className="mt-2 text-sm text-body">
              About {e.tip.events} fewer {HAC_EVENT_NOUN[e.tip.measure][e.tip.events === 1 ? 0 : 1]} would move it below the line.
            </p>
          )}
          <ArrowLink href={`#/hospital/${e.ccn}`} className="mt-4">View hospital</ArrowLink>
        </article>
      ))}
    </>
  )
}

function KeyFacts({ n }: { n: National }) {
  const c = n.counts
  const eligible = c.hac_scored - c.exempt
  const top = [...n.tipping_counts].sort((a, b) => b.count - a.count)[0]
  const facts = [
    {
      big: fmtPct(eligible ? (c.penalized / eligible) * 100 : null, 0),
      text: `of hospitals in the program are above the penalty line this year (${fmtInt(c.penalized)} of ${fmtInt(eligible)}).`,
    },
    {
      big: fmtInt(n.within_two.penalized_clear_with_le2),
      text: 'penalized hospitals could get below the line by preventing just 1 or 2 infections of one kind.',
    },
    top && {
      big: HAC_LABELS[top.measure],
      text: `are the most common "biggest opportunity": the infection type where the fewest prevented cases would clear the line, at ${fmtInt(top.count)} hospitals.`,
    },
  ].filter(Boolean) as { big: string; text: string }[]
  return (
    <>
      {facts.map((f) => (
        <article key={f.big} className="bg-surface p-6 shadow-card">
          <div className="tabular text-3xl font-light leading-tight text-ink">{f.big}</div>
          <p className="mt-2 text-[15px] leading-relaxed text-body">{f.text}</p>
        </article>
      ))}
      <SourceNote>{HAC_SOURCE}, with infection counts from the CMS Healthcare Associated Infections file. CareSignal calculation.</SourceNote>
    </>
  )
}

const LENS: { category: Category; text: string }[] = [
  { category: 'nursing', text: 'Mostly in the hands of bedside nurses. Examples: catheter infections, central line infections, pressure injuries, falls, and how well nurses communicate.' },
  { category: 'shared', text: 'Nurses share these with other teams such as infection prevention, cleaning staff and pharmacy. Examples: C. diff, MRSA, readmissions.' },
  { category: 'other', text: 'Mostly driven by surgeons, physicians or hospital systems. Example: surgical site infections.' },
]

function Legend() {
  const statuses: [HacStatus, string][] = [
    ['penalized', 'Medicare is cutting this hospital\'s payments by 1% this year.'],
    ['near', 'Not penalized, but 1 or 2 more infections of one kind could push it over.'],
    ['clear', 'Comfortably below the penalty line.'],
  ]
  return (
    <>
      <article className="bg-surface p-6 shadow-card">
        <h3 className="text-lg font-bold text-ink">Hospital status</h3>
        <ul className="mt-3 space-y-3">
          {statuses.map(([s, t]) => (
            <li key={s}><StatusPill status={s} /><p className="mt-1 text-sm text-body">{t}</p></li>
          ))}
        </ul>
      </article>
      <article className="bg-surface p-6 shadow-card">
        <h3 className="text-lg font-bold text-ink">Who can act on it</h3>
        <ul className="mt-3 space-y-3">
          {LENS.map((l) => (
            <li key={l.category}><CategoryBadge category={l.category} /><p className="mt-1 text-sm text-body">{l.text}</p></li>
          ))}
        </ul>
      </article>
    </>
  )
}
