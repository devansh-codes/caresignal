import { useMemo } from 'react'
import { StateView } from '../components/ui'
import { ChartFrame, MiniTable } from '../components/insights/ChartFrame'
import { SortableTable, type Column } from '../components/insights/SortableTable'
import { HacHistogram, NurseCommScatter, NursingShareChart, PeerPenaltyChart, TippingChart } from '../components/insights/charts'
import { ArrowLink, BigStat, Eyebrow, PageIntro, Panel, Source, StatRow } from '../components/insights/layout'
import { loadManifest, loadNational, useData } from '../lib/data'
import { CATEGORY_LABEL, HAC_LABELS, fmt, fmtDate, fmtInt, fmtPct, fmtPeriod } from '../lib/format'
import type { Manifest, National } from '../lib/types'

const HAC_SRC = 'yq43-i98g'

/** Plain source line for anything derived from the official HAC file, with its period from the manifest. */
function hacSource(m: Manifest | null, fy: number) {
  const s = m?.sources.find((x) => x.id === HAC_SRC)
  const period = s?.period ? ` (care from ${fmtPeriod(s.period)})` : ''
  return `CMS Hospital Acquired Condition Reduction Program, FY${fy}${period}${s?.modified ? `, published ${fmtDate(s.modified)}` : ''}`
}

/** Accept a share stored as a 0 to 1 fraction or as a 0 to 100 percent. */
const asPct = (v: number, all: number[]) => (all.every((x) => x <= 1) ? v * 100 : v)

export default function Insights() {
  const nat = useData(loadNational)
  const man = useData(loadManifest)
  if (nat.status === 'loading') return <StateView kind="loading" />
  if (nat.status === 'error') return <StateView kind="error" message={`The national picture could not be loaded (${nat.error}).`} />
  return <InsightsView n={nat.data} manifest={man.status === 'ready' ? man.data : null} />
}

function InsightsView({ n, manifest }: { n: National; manifest: Manifest | null }) {
  const fy = n.hac_params.fiscal_year
  const cutoff = n.hac_params.cutoff
  const src = hacSource(manifest, fy)
  const { counts } = n
  const eligible = counts.hac_scored - counts.exempt
  const penalizedShare = eligible ? (counts.penalized / eligible) * 100 : null

  const peerRows = useMemo(() => {
    const all = n.by_peer.map((r) => r.pct)
    return n.by_peer.map((r) => ({ ...r, pct: asPct(r.pct, all) }))
  }, [n.by_peer])
  const stateRows = useMemo(() => {
    const all = n.by_state.map((r) => r.pct)
    return n.by_state.map((r) => ({ ...r, pct: asPct(r.pct, all) }))
  }, [n.by_state])
  const shareRows = useMemo(() => {
    const all = n.nursing_share.map((r) => r.share)
    return n.nursing_share.map((r) => ({ ...r, share: asPct(r.share, all) / 100 }))
  }, [n.nursing_share])
  const nursingShare = shareRows.find((r) => r.category === 'nursing')
  const tips = [...n.tipping_counts].sort((a, b) => b.count - a.count)
  const topTip = tips[0]
  const topPeer = [...peerRows].filter((r) => r.n >= 15).sort((a, b) => b.pct - a.pct)[0]
  const topState = [...stateRows].filter((r) => r.n >= 10).sort((a, b) => b.pct - a.pct)[0]
  const r = n.correlation?.r

  const peerCols: Column<(typeof peerRows)[number]>[] = [
    { key: 'label', header: 'Type of hospital', sortValue: (x) => x.label, render: (x) => x.label },
    { key: 'n', header: 'Hospitals', align: 'right', sortValue: (x) => x.n, render: (x) => fmtInt(x.n) },
    { key: 'penalized', header: 'Above the line', align: 'right', sortValue: (x) => x.penalized, render: (x) => fmtInt(x.penalized) },
    { key: 'pct', header: 'Share above', align: 'right', sortValue: (x) => x.pct, render: (x) => fmtPct(x.pct, 1) },
    { key: 'median', header: 'Typical safety score', align: 'right', sortValue: (x) => x.median_hac, render: (x) => fmt(x.median_hac, 2) },
  ]
  const stateCols: Column<(typeof stateRows)[number]>[] = [
    { key: 'state', header: 'State', sortValue: (x) => x.state, render: (x) => <span className="font-semibold">{x.state}</span> },
    { key: 'n', header: 'Hospitals with a score', align: 'right', sortValue: (x) => x.n, render: (x) => fmtInt(x.n) },
    { key: 'penalized', header: 'Above the line', align: 'right', sortValue: (x) => x.penalized, render: (x) => fmtInt(x.penalized) },
    {
      key: 'pct', header: 'Share above', align: 'right', sortValue: (x) => x.pct,
      render: (x) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span aria-hidden className="hidden h-2 w-20 overflow-hidden bg-surface-2 sm:inline-block">
            <span className="block h-full bg-primary" style={{ width: `${Math.min(x.pct, 100)}%` }} />
          </span>
          {fmtPct(x.pct, 1)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow={`National picture, FY${fy}`}
        title="How U.S. hospitals stand on patient safety penalties"
        lead="Every year Medicare cuts payments by 1% for the quarter of hospitals with the worst safety scores. Here is how close hospitals across the country are to that line, and what tips them over it."
        tells={<>
          How many hospitals are above, close to or below the penalty line; which infections most often decide it; and how much of the score
          nurses directly influence. Every number is calculated from public CMS files. To see one hospital, use the <ArrowLink to="/hospitals">hospital list</ArrowLink>.
        </>}
      />

      {/* 1. The big numbers */}
      <section aria-label="National counts">
        <StatRow>
          <BigStat above="Hospitals with a safety score" value={fmtInt(counts.hac_scored)}
            below={`Out of ${fmtInt(counts.facilities)} hospitals in the CMS list`} />
          <BigStat above="Above the penalty line" tone="critical" value={fmtInt(counts.penalized)}
            below={penalizedShare != null ? `${fmtPct(penalizedShare, 0)} of hospitals that can be penalized. Each loses 1% of Medicare payments.` : undefined} />
          <BigStat above="Close to the line" tone="warning" value={fmtInt(counts.near)}
            below={`Below the line, but ${n.hac_params.near_band} or fewer extra infections would push them over`} />
          <BigStat above="Below the line" tone="ok" value={fmtInt(counts.clear)}
            below={`Safely below. Another ${fmtInt(counts.exempt)} Maryland hospitals are scored but exempt.`} />
        </StatRow>
        <Source>{src}. CMS flagged {fmtInt(counts.official_flagged)} hospitals in total; the difference is explained on the How it works page.</Source>
      </section>

      {/* 2. Key findings in plain words */}
      <section aria-labelledby="findings">
        <Eyebrow>Key findings</Eyebrow>
        <h2 id="findings" className="mt-1 text-2xl font-bold tracking-tight text-ink">What stands out</h2>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Finding
            label="Small changes matter"
            title={`${fmtInt(n.within_two.penalized_clear_with_le2)} hospitals above the line are two infections or fewer from clearing it`}
            body={`That is ${fmtPct((n.within_two.penalized_clear_with_le2 / Math.max(counts.penalized, 1)) * 100, 0)} of all hospitals above the line. Preventing a couple of infections of one type would be enough.`} />
          {topTip && (
            <Finding label="Easiest fix"
              title={`${HAC_LABELS[topTip.measure]} are most often the easiest way out`}
              body={`For ${fmtInt(topTip.count)} hospitals above the line, preventing ${HAC_LABELS[topTip.measure].toLowerCase()} is the quickest route below it.`} />
          )}
          {nursingShare && (
            <Finding label="Nursing's part"
              title={`${fmtPct(nursingShare.share * 100, 0)} of the penalty points come from measures nurses drive`}
              body="Catheter and central line infections depend mostly on daily nursing care. Most other points are shared with other teams." />
          )}
          {topPeer && (
            <Finding label="Who is most affected"
              title={`${fmtPct(topPeer.pct, 0)} of hospitals in one group are above the line`}
              body={`The group is ${topPeer.label}: ${fmtInt(topPeer.penalized)} of ${fmtInt(topPeer.n)} hospitals, the highest share of any group with at least 15 hospitals.`} />
          )}
          {r != null && (
            <Finding label="Patient experience"
              title={Math.abs(r) < 0.1 ? 'Nurse communication scores barely track safety scores' : 'Nurse communication scores track safety scores'}
              body={`Across ${fmtInt(n.correlation!.n)} hospitals the link is ${Math.abs(r) < 0.1 ? 'very weak' : Math.abs(r) < 0.3 ? 'weak' : 'moderate'}. This shows a pattern only, not cause and effect.`} />
          )}
          {topState && (
            <Finding label="By state"
              title={`${topState.state} has the highest share above the line`}
              body={`${fmtInt(topState.penalized)} of its ${fmtInt(topState.n)} scored hospitals (${fmtPct(topState.pct, 0)}), counting states with at least 10 scored hospitals.`} />
          )}
        </div>
        <Source>{src}; expected infection counts from CMS Healthcare Associated Infections</Source>
      </section>

      {/* 3. Distribution with the penalty line */}
      <ChartFrame
        id="distribution"
        title="About one in four hospitals sit above the penalty line"
        subtitle={`Each bar counts hospitals with a similar safety score. Bars in red are above the penalty line (${fmt(cutoff, 2)}), where Medicare cuts payments by 1%.`}
        chart={<HacHistogram histogram={n.hac_histogram} cutoff={cutoff} />}
        howToRead="Scores further to the right mean more patient harm than average. The red line is the penalty line. Taller bars mean more hospitals have that score."
        table={<MiniTable caption="Number of hospitals by safety score" headers={['Safety score range', 'Hospitals']}
          rows={n.hac_histogram.counts.map((c, i) => [`${fmt(n.hac_histogram.bins[i], 2)} to ${fmt(n.hac_histogram.bins[i + 1], 2)}`, c])} />}
        source={src}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ChartFrame
          title={nursingShare ? `Nurses directly drive about ${fmtPct(nursingShare.share * 100, 0)} of penalty points` : 'Who owns the penalty points'}
          subtitle="For hospitals above the line, we added up the points pushing each score above average and grouped them by which team mainly owns the measure."
          chart={<NursingShareChart share={shareRows} />}
          howToRead="Longer bars mean that group of measures adds more to the penalty. Patient safety events count as Shared because CMS does not split out pressure ulcers and falls."
          table={<MiniTable caption="Penalty points by who owns the measure" headers={['Group', 'Share of points']}
            rows={shareRows.map((x) => [CATEGORY_LABEL[x.category], fmtPct(x.share * 100, 1)])} />}
          source={`${src}; measure groups from the CareSignal measure map`}
        />
        <Panel title="Many hospitals are one or two infections from the line"
          intro="These counts change one infection type at a time and assume other hospitals stay the same, so treat them as estimates.">
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <BigStat above="Above the line, could clear it" value={fmtInt(n.within_two.penalized_clear_with_le2)}
              below="with 2 or fewer prevented infections of one type" />
            <BigStat above="Below the line, could cross it" tone="warning" value={fmtInt(n.within_two.clear_cross_with_le2)}
              below="with 2 or fewer extra infections of one type" />
          </div>
          <p className="mt-4 text-[15px] text-muted">
            For hospitals that expect only a few infections, one case moves the score a lot. Look up a specific hospital to see its numbers.
          </p>
          <div className="mt-4"><ArrowLink to="/hospitals">Find a hospital</ArrowLink></div>
          <Source>{src}; expected infection counts from CMS Healthcare Associated Infections</Source>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ChartFrame
          title={topTip ? `${HAC_LABELS[topTip.measure]} are most often the easiest fix` : 'The easiest fix for hospitals above the line'}
          subtitle="For each hospital above the line, we found the one infection type where the fewest prevented cases would clear it, then counted hospitals by that type."
          chart={<TippingChart counts={n.tipping_counts} />}
          howToRead="Each bar is the number of hospitals for which that infection type is the quickest way below the line."
          table={<MiniTable caption="Hospitals by easiest fix" headers={['Infection type', 'Hospitals']}
            rows={tips.map((x) => [HAC_LABELS[x.measure], x.count])} />}
          source={`${src}; expected infection counts from CMS Healthcare Associated Infections`}
        />
        <ChartFrame
          title="Better nurse communication scores do not clearly mean better safety scores"
          subtitle={n.correlation
            ? `Each dot is one of ${fmtInt(n.correlation.n)} hospitals. The relationship is ${r != null && Math.abs(r) < 0.1 ? 'very weak' : 'weak'} (correlation ${fmt(n.correlation.r, 2)}).`
            : 'Each dot is a hospital with both scores.'}
          chart={<NurseCommScatter points={n.scatter_nurse_comm_vs_hac} cutoff={cutoff} />}
          howToRead="Dots further right have better nurse communication. Dots higher up have worse safety scores. Red dots are above the penalty line."
          table={<MiniTable caption="Nurse communication and safety score by hospital" headers={['Hospital ID', 'Nurse communication %', 'Safety score']}
            rows={n.scatter_nurse_comm_vs_hac.slice(0, 500).map((p) => [p.ccn, fmt(p.x, 0), fmt(p.y, 2)])} />}
          footer={<p className="mt-3 bg-surface-2 px-4 py-2.5 text-sm text-muted"><strong className="text-ink">A pattern, not a cause.</strong> The two scores cover different time periods and both depend on many things a hospital does.</p>}
          source={`CMS patient survey (HCAHPS), nurse communication, and ${src}`}
        />
      </div>

      <ChartFrame
        title="Some types of hospital are far more likely to be above the line"
        subtitle="We group hospitals by size, teaching role, city or rural setting and region. The chart shows the 12 groups with the highest share above the line (groups of 15 or more). The table lists every group."
        chart={<PeerPenaltyChart rows={peerRows} />}
        howToRead="Longer bars mean a larger share of that kind of hospital is above the penalty line."
        table={<SortableTable caption="Share above the penalty line by type of hospital" rows={peerRows} columns={peerCols} rowKey={(x) => x.key} initialSort="pct" />}
        source={`${src}; hospital size and teaching role from the CMS Hospital Cost Report`}
      />

      <Panel title="Share above the line by state"
        intro="Click a column name to sort. Maryland hospitals get a safety score but are exempt from the penalty under the state's own Medicare agreement.">
        <SortableTable caption="Share above the penalty line by state" rows={stateRows} columns={stateCols} rowKey={(x) => x.state} initialSort="pct" maxHeight={520} />
        <Source>{src}</Source>
      </Panel>
    </div>
  )
}

function Finding({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <article className="flex flex-col bg-surface p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{label}</p>
      <h3 className="mt-2 text-lg font-bold leading-snug text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
    </article>
  )
}
