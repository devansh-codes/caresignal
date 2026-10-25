import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, KpiTile, PageHeader, SourceNote, StateView } from '../components/ui'
import { ChartFrame, MiniTable } from '../components/insights/ChartFrame'
import { SortableTable, type Column } from '../components/insights/SortableTable'
import { HacHistogram, NurseCommScatter, NursingShareChart, PeerPenaltyChart, TippingChart } from '../components/insights/charts'
import { loadManifest, loadNational, useData } from '../lib/data'
import { CATEGORY_LABEL, HAC_LABELS, fmt, fmtDate, fmtInt, fmtPct, fmtPeriod } from '../lib/format'
import type { Manifest, National } from '../lib/types'

const HAC_SRC = 'yq43-i98g'

/** Source line for anything derived from the official HAC file, with its periods from the manifest. */
function hacSource(m: Manifest | null, fy: number) {
  const s = m?.sources.find((x) => x.id === HAC_SRC)
  const period = s?.period ? ` · ${fmtPeriod(s.period)}` : ''
  return `CMS HAC Reduction Program FY${fy} (${HAC_SRC})${period}${s?.modified ? ` · updated ${fmtDate(s.modified)}` : ''}`
}

/** Accept a share stored as a 0–1 fraction or as a 0–100 percent. */
const asPct = (v: number, all: number[]) => (all.every((x) => x <= 1) ? v * 100 : v)

export default function Insights() {
  const nat = useData(loadNational)
  const man = useData(loadManifest)
  if (nat.status === 'loading') return <StateView kind="loading" />
  if (nat.status === 'error') return <StateView kind="error" message={`National insights could not be loaded (${nat.error}).`} />
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
  const topTip = [...n.tipping_counts].sort((a, b) => b.count - a.count)[0]

  const peerCols: Column<(typeof peerRows)[number]>[] = [
    { key: 'label', header: 'Peer group', sortValue: (r) => r.label, render: (r) => r.label },
    { key: 'n', header: 'Hospitals', align: 'right', sortValue: (r) => r.n, render: (r) => fmtInt(r.n) },
    { key: 'penalized', header: 'Penalized', align: 'right', sortValue: (r) => r.penalized, render: (r) => fmtInt(r.penalized) },
    { key: 'pct', header: '% penalized', align: 'right', sortValue: (r) => r.pct, render: (r) => fmtPct(r.pct, 1) },
    { key: 'median', header: 'Median HAC', align: 'right', sortValue: (r) => r.median_hac, render: (r) => fmt(r.median_hac, 3) },
  ]
  const stateCols: Column<(typeof stateRows)[number]>[] = [
    { key: 'state', header: 'State', sortValue: (r) => r.state, render: (r) => <span className="font-medium">{r.state}</span> },
    { key: 'n', header: 'Scored hospitals', align: 'right', sortValue: (r) => r.n, render: (r) => fmtInt(r.n) },
    { key: 'penalized', header: 'Penalized', align: 'right', sortValue: (r) => r.penalized, render: (r) => fmtInt(r.penalized) },
    {
      key: 'pct', header: '% penalized', align: 'right', sortValue: (r) => r.pct,
      render: (r) => (
        <span className="inline-flex items-center justify-end gap-2">
          <span aria-hidden className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:inline-block">
            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.min(r.pct, 100)}%` }} />
          </span>
          {fmtPct(r.pct, 1)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`National view · FY${fy} HAC Reduction Program`}
        title="National insights"
        description="Where U.S. hospitals sit relative to the HAC penalty line, which measures tip them over it, and how much of the score nursing practice directly influences. All figures are computed from public CMS files; nothing is estimated by hand."
      />

      {/* 1. Headline KPIs — the decision-relevant counts first */}
      <section aria-label="Headline counts" className="grid grid-cols-1 grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label="Facilities" value={fmtInt(counts.facilities)} context="In Hospital General Information" />
        <KpiTile label="HAC-scored" value={fmtInt(counts.hac_scored)} context={`Have a FY${fy} Total HAC Score (${fmtInt(counts.exempt)} Maryland, waived)`} />
        <KpiTile label="Penalized" tone="critical" value={fmtInt(counts.penalized)}
          context={penalizedShare != null ? `${fmtPct(penalizedShare, 1)} of eligible scored · 1% payment cut` : undefined}
          info={`Hospitals CMS flagged for the 1% payment reduction (worst-performing quartile of Total HAC Score) that have a CareSignal profile. CMS flagged ${fmtInt(counts.official_flagged)} in total; ${fmtInt(counts.exempt)} Maryland hospitals are scored but waived.`} />
        <KpiTile label="Near the line" tone="warning" value={fmtInt(counts.near)}
          context={`Clear, but ≤${n.hac_params.near_band} added infections from crossing`}
          info="Not penalized, but the smallest cushion across HAI measures is at most two additional infections, holding peers and the cutoff constant." />
        <KpiTile label="Clear" tone="ok" value={fmtInt(counts.clear)} context="Below the cutoff with cushion" />
      </section>
      <SourceNote>{src}. Status rules are on the Methodology page.</SourceNote>

      {/* 2. Computed headline insights */}
      {n.insights.length > 0 && (
        <section aria-labelledby="key-findings">
          <h2 id="key-findings" className="mb-3 text-lg font-semibold">Key findings</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {n.insights.map((i) => (
              <article key={i.id} className="flex flex-col rounded-card border border-border bg-surface p-4">
                <h3 className="text-sm font-medium text-muted">{i.title}</h3>
                <p className="mt-1 text-2xl font-semibold text-ink">{i.value}</p>
                <p className="mt-1 flex-1 text-sm text-muted">{i.detail}</p>
                <SourceNote>{i.source} · {i.period}</SourceNote>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 3. Distribution with the penalty line */}
      <ChartFrame
        id="distribution"
        title="Distribution of Total HAC Scores"
        subtitle={`Hospitals above the 75th-percentile cutoff (${fmt(cutoff, 4)}) receive a 1% Medicare payment reduction. Red bins lie entirely above the line.`}
        chart={<HacHistogram histogram={n.hac_histogram} cutoff={cutoff} />}
        table={<MiniTable caption="Total HAC Score histogram" headers={['Score range', 'Hospitals']}
          rows={n.hac_histogram.counts.map((c, i) => [`${fmt(n.hac_histogram.bins[i], 2)} to ${fmt(n.hac_histogram.bins[i + 1], 2)}`, c])} />}
        source={src}
      />

      {/* 4. Nursing lens + proximity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartFrame
          title="Who owns the penalty: adverse HAC points by category"
          subtitle={nursingShare
            ? `Among penalized hospitals, ${fmtPct(nursingShare.share * 100, 1)} of above-average weighted z-score points come from nursing-driven measures (CLABSI, CAUTI). PSI 90 counts as shared because its nursing-sensitive components (PSI 03, PSI 08) cannot be split out of the published composite.`
            : 'Share of penalized hospitals’ above-average weighted HAC points attributable to each measure category.'}
          chart={<NursingShareChart share={shareRows} />}
          table={<MiniTable caption="Adverse weighted HAC points by category, penalized hospitals" headers={['Category', 'Points', 'Share']}
            rows={shareRows.map((r) => [CATEGORY_LABEL[r.category], fmt(r.points, 1), fmtPct(r.share * 100, 1)])} />}
          source={`${src}; nursing categories from the CareSignal measure map`}
        />
        <Card title="Hospitals one or two infections from the line"
          subtitle="Single-measure changes on HAI measures, holding peers and the cutoff constant. Approximate.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KpiTile label="Penalized → could clear" value={fmtInt(n.within_two.penalized_clear_with_le2)}
              context="Penalized hospitals that clear the cutoff with ≤2 fewer infections in one measure" />
            <KpiTile label="Clear → at risk" tone="warning" value={fmtInt(n.within_two.clear_cross_with_le2)}
              context="Clear hospitals that would cross the cutoff with ≤2 more infections in one measure" />
          </div>
          <p className="mt-3 text-sm text-muted">
            A small number of infections moves these hospitals across the line in either direction. For a specific hospital, open its
            profile from the <Link className="font-medium text-primary underline-offset-2 hover:underline" to="/hospitals">hospital directory</Link>.
          </p>
          <SourceNote>{src}; predicted infection counts from CMS Healthcare Associated Infections (77hc-ibv8)</SourceNote>
        </Card>
      </div>

      {/* 5. Tipping measure + correlation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartFrame
          title="Most common tipping measure"
          subtitle={topTip
            ? `${HAC_LABELS[topTip.measure]} is most often the cheapest single measure for a penalized hospital to clear the cutoff (${fmtInt(topTip.count)} hospitals).`
            : 'The measure needing the fewest prevented events to clear the cutoff.'}
          chart={<TippingChart counts={n.tipping_counts} />}
          table={<MiniTable caption="Tipping measure counts" headers={['Measure', 'Hospitals']}
            rows={[...n.tipping_counts].sort((a, b) => b.count - a.count).map((r) => [HAC_LABELS[r.measure], r.count])} />}
          source={`${src}; predicted counts from 77hc-ibv8`}
        />
        <ChartFrame
          title="Nurse communication vs Total HAC Score"
          subtitle={n.correlation
            ? `Pearson r = ${fmt(n.correlation.r, 2)} across ${fmtInt(n.correlation.n)} hospitals with both values.`
            : 'Hospitals with both an HCAHPS nurse communication score and a Total HAC Score.'}
          chart={<NurseCommScatter points={n.scatter_nurse_comm_vs_hac} cutoff={cutoff} />}
          table={<MiniTable caption="Nurse communication and HAC score by hospital" headers={['CCN', 'Nurse comm top-box %', 'Total HAC']}
            rows={n.scatter_nurse_comm_vs_hac.slice(0, 500).map((p) => [p.ccn, fmt(p.x, 0), fmt(p.y, 4)])} />}
          footer={<p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted"><strong className="text-ink">Correlation, not causation.</strong> The HCAHPS and HAC periods differ, and both scores reflect many hospital factors. This chart describes an association only.</p>}
          source={`CMS HCAHPS – Hospital (dgck-syfz, H_COMP_1_A_P) and ${src}`}
        />
      </div>

      {/* 6. Peer and state breakdowns */}
      <ChartFrame
        title="Penalty rate by peer group"
        subtitle="Peer groups combine bed size, teaching intensity, urban/rural location and Census region. The chart shows the 12 highest-rate groups with ≥15 hospitals, and the table lists all groups."
        chart={<PeerPenaltyChart rows={peerRows} />}
        table={<SortableTable caption="Penalty rate by peer group" rows={peerRows} columns={peerCols} rowKey={(r) => r.key} initialSort="pct" />}
        source={`${src}; peer attributes from the CMS Hospital Provider Cost Report`}
      />
      <Card title="Penalty rate by state" subtitle="Sort any column. Maryland hospitals are scored, but they are exempt from HAC payment adjustments under the state's Medicare waiver model.">
        <SortableTable caption="Penalty rate by state" rows={stateRows} columns={stateCols} rowKey={(r) => r.state} initialSort="pct" maxHeight={520} />
        <SourceNote>{src}</SourceNote>
      </Card>
    </div>
  )
}
