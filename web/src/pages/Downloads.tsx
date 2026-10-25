import { useEffect, useState, type ReactNode } from 'react'
import { Card, PageHeader, SourceNote } from '../components/ui'
import { loadIndex, loadManifest, useData } from '../lib/data'
import { fmtDate } from '../lib/format'

const BASE = import.meta.env.BASE_URL

interface FileDef {
  path: string // relative to BASE_URL
  name: string
  description: ReactNode
  format: string
}

const WORKBOOK: FileDef = {
  path: 'downloads/CareSignal_Workbook.xlsx',
  name: 'CareSignal_Workbook.xlsx',
  format: 'Excel workbook',
  description: 'A live, formula-driven workbook generated on every build. Pick a hospital from a dropdown and every metric updates, and blue input cells run what-if scenarios.',
}

const WORKBOOK_SHEETS: [string, string][] = [
  ['README', 'Purpose, sources and refresh date'],
  ['Hospital Lookup', 'Hospital selector; XLOOKUP pulls every metric, conditional formatting vs the cutoff, peer averages via AVERAGEIFS'],
  ['Data', 'All hospitals as an Excel Table: CCN, peer group, measures, z-scores, Total HAC'],
  ['HAC Calculator', 'Winsorization, z-scores, weights and total recalculated with live formulas'],
  ['Patients to Prevent', 'The infections-to-prevent formula, cell by cell'],
  ['Peer Benchmark', 'Percentile ranks within the peer group (PERCENTRANK.INC)'],
  ['HCAHPS', 'Nurse communication percentile and gap to the peer median'],
  ['DQ Log', 'Validation rules and record counts'],
  ['Definitions', 'Measure dictionary with nursing category'],
]

const CSVS: FileDef[] = [
  { path: 'downloads/caresignal_hospital_metrics.csv', name: 'caresignal_hospital_metrics.csv', format: 'CSV', description: 'One row per hospital: peer group, HAC measures and z-scores, status, patients-to-prevent, trajectory, HCAHPS and readmission ratios.' },
  { path: 'downloads/caresignal_peer_groups.csv', name: 'caresignal_peer_groups.csv', format: 'CSV', description: 'One row per peer group: key, label, number of hospitals, number with a HAC score, and whether it is a fallback (bed size and teaching only) group.' },
  { path: 'downloads/dq_log.csv', name: 'dq_log.csv', format: 'CSV', description: 'Every validation rule with the dataset, severity, records checked and failures.' },
]

const API: { path: string; description: string }[] = [
  { path: 'data/index.json', description: 'Searchable list of every facility with HAC status and tipping measure.' },
  { path: 'data/national.json', description: 'National counts, distributions, insights and the HAC parameters (cutoff, Winsorization bounds, mean, SD).' },
  { path: 'data/manifest.json', description: 'Source files with CMS modified dates, periods, row counts and SHA-256 hashes.' },
  { path: 'data/accuracy.json', description: 'HAC rebuild accuracy compared with the official CMS file.' },
  { path: 'data/dq.json', description: 'Validation rule results.' },
  { path: 'data/measures.json', description: 'Measure dictionary, nursing categories with rationale, and CMS footnote codes.' },
]

type Avail = { ok: boolean; size: number | null } | undefined

/** HEAD-probe each file so a missing artifact shows as unavailable instead of a dead link. */
function useAvailability(paths: string[]) {
  const [state, setState] = useState<Record<string, Avail>>({})
  const key = paths.join('|')
  useEffect(() => {
    let live = true
    paths.forEach((p) => {
      fetch(BASE + p, { method: 'HEAD' })
        .then((r) => {
          const len = r.headers.get('content-length')
          const html = (r.headers.get('content-type') ?? '').includes('text/html')
          if (live) setState((s) => ({ ...s, [p]: { ok: r.ok && !html, size: len ? Number(len) : null } }))
        })
        .catch(() => live && setState((s) => ({ ...s, [p]: { ok: false, size: null } })))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

const fmtSize = (b: number | null) =>
  b == null ? '' : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`

function DownloadRow({ f, avail, primary }: { f: FileDef; avail: Avail; primary?: boolean }) {
  const missing = avail && !avail.ok
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-ink">{f.name}</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{f.format}</span>
          {avail?.ok && avail.size != null && <span className="text-xs text-muted">{fmtSize(avail.size)}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">{f.description}</p>
      </div>
      {missing ? (
        <span className="shrink-0 text-sm text-muted">Not in this build</span>
      ) : (
        <a href={BASE + f.path} download={f.name}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${primary ? 'bg-primary text-primary-ink hover:opacity-90' : 'border border-border bg-surface text-ink hover:bg-surface-2'}`}>
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 fill-current"><path d="M8 1.5a.75.75 0 0 1 .75.75v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V2.25A.75.75 0 0 1 8 1.5ZM2.75 12a.75.75 0 0 1 .75.75v.75h9v-.75a.75.75 0 0 1 1.5 0v1.5a.75.75 0 0 1-.75.75H2.75a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75Z" /></svg>
          Download<span className="sr-only"> {f.name}</span>
        </a>
      )}
    </div>
  )
}

export default function Downloads() {
  const idx = useData(loadIndex)
  const man = useData(loadManifest)
  const avail = useAvailability([WORKBOOK.path, ...CSVS.map((c) => c.path)])
  const example = idx.status === 'ready' ? (idx.data.find((h) => h.hac != null) ?? idx.data[0]) : null
  const builtAt = man.status === 'ready' ? man.data.built_at : null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Open data"
        title="Downloads"
        description={`Everything behind this site is free to download and is regenerated from CMS on every build${builtAt ? ` (last build ${fmtDate(builtAt.slice(0, 10))})` : ''}. Use the workbook for offline analysis or the JSON files to build your own views.`}
      />

      <Card title="Excel workbook" subtitle="For quality analysts and finance partners who want to audit or extend the math.">
        <DownloadRow f={WORKBOOK} avail={avail[WORKBOOK.path]} primary />
        <h3 className="mt-5 text-sm font-semibold">Sheets</h3>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {WORKBOOK_SHEETS.map(([s, d]) => (
            <div key={s} className="text-sm">
              <dt className="font-medium text-ink">{s}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">Lookups use XLOOKUP (Excel 2021/365 or LibreOffice 24.8+), with an INDEX/MATCH fallback for older versions.</p>
      </Card>

      <Card title="Processed tables (CSV)" subtitle="Tidy, analysis-ready extracts. CCNs are 6-character text, so open them with the column type set to Text to keep leading zeros.">
        <div className="space-y-3">
          {CSVS.map((f) => <DownloadRow key={f.path} f={f} avail={avail[f.path]} />)}
        </div>
      </Card>

      <Card title="JSON data API" subtitle="The static JSON files this site reads, served from GitHub Pages with no key and no rate limit beyond Pages' fair use.">
        <ul className="divide-y divide-border rounded-md border border-border">
          {API.map((a) => (
            <li key={a.path} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <a href={BASE + a.path} className="font-mono text-sm font-medium text-primary hover:underline" target="_blank" rel="noreferrer">{a.path}</a>
                <p className="text-sm text-muted">{a.description}</p>
              </div>
            </li>
          ))}
          <li className="px-4 py-3">
            <span className="font-mono text-sm font-medium text-ink">data/hospitals/{'{ccn}'}.json</span>
            <p className="text-sm text-muted">The full profile of one hospital: HAC breakdown, patients-to-prevent, trajectory, HAI, PSI, HCAHPS, readmissions and VBP.</p>
            {example && (
              <p className="mt-1 text-sm">
                Example:{' '}
                <a className="font-mono text-primary hover:underline" href={`${BASE}data/hospitals/${example.ccn}.json`} target="_blank" rel="noreferrer">
                  data/hospitals/{example.ccn}.json
                </a>{' '}
                <span className="text-muted">({example.name}, {example.city}, {example.state})</span>
              </p>
            )}
          </li>
          <li className="px-4 py-3">
            <span className="font-mono text-sm font-medium text-ink">data/peers/{'{peer_key}'}.json</span>
            <p className="text-sm text-muted">Values for every hospital in a peer group, used for the distribution charts. Keys look like <code className="font-mono">b100_299-minor-urban-south</code>.</p>
          </li>
        </ul>
        <pre className="mt-4 overflow-x-auto rounded-md border border-border bg-surface-2 px-4 py-3 font-mono text-[13px] text-ink">
{`curl -s ${origin}${BASE}data/index.json | jq '.[] | select(.status=="near") | .name' | head`}
        </pre>
        <p className="mt-2 text-xs text-muted">Field definitions are in <code className="font-mono">web/src/lib/types.ts</code> and <code className="font-mono">docs/CONTRACTS.md</code> in the project repository.</p>
      </Card>

      <Card title="License and attribution">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li><strong className="text-ink">Data:</strong> public U.S. government data from the Centers for Medicare &amp; Medicaid Services (CMS Provider Data Catalog and data.cms.gov). CMS does not endorse CareSignal or its derived metrics.</li>
          <li><strong className="text-ink">Derived metrics</strong> (rebuilt scores, patients-to-prevent, peer groups, nursing categories) are CareSignal calculations, documented on the Methodology page.</li>
          <li><strong className="text-ink">Code:</strong> MIT License.</li>
          <li>Please cite as: <em>CareSignal, built on CMS public data</em>, with the build date and the CMS source files you used.</li>
        </ul>
        <SourceNote>CMS Provider Data Catalog (data.cms.gov/provider-data) and data.cms.gov</SourceNote>
      </Card>
    </div>
  )
}
