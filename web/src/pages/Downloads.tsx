import { useEffect, useState } from 'react'
import { loadIndex, loadManifest, useData } from '../lib/data'
import { fmtDate } from '../lib/format'
import { ArrowLink, Eyebrow, PageIntro, Panel, Source } from '../components/insights/layout'

const BASE = import.meta.env.BASE_URL

interface FileDef {
  path: string // relative to BASE_URL
  name: string
  kind: string
  title: string
  description: string
  who: string
}

const FILES: FileDef[] = [
  {
    path: 'downloads/CareSignal_Workbook.xlsx', name: 'CareSignal_Workbook.xlsx', kind: 'Excel workbook',
    title: 'The full workbook',
    description: 'Pick any hospital from a list and every number updates. Change the blue cells to try your own what if scenarios. All the math is written as live formulas you can inspect.',
    who: 'For quality, finance and nursing leaders',
  },
  {
    path: 'downloads/caresignal_hospital_metrics.csv', name: 'caresignal_hospital_metrics.csv', kind: 'Spreadsheet (CSV)',
    title: 'Every hospital, one row each',
    description: 'Safety score, status, infections to prevent, similar hospital group, patient experience and readmission ratios for every hospital.',
    who: 'For analysts',
  },
  {
    path: 'downloads/caresignal_peer_groups.csv', name: 'caresignal_peer_groups.csv', kind: 'Spreadsheet (CSV)',
    title: 'Similar hospital groups',
    description: 'Each group of similar hospitals with its size, teaching role, setting, region and how many hospitals are in it.',
    who: 'For analysts',
  },
  {
    path: 'downloads/dq_log.csv', name: 'dq_log.csv', kind: 'Spreadsheet (CSV)',
    title: 'Data check log',
    description: 'Every automatic check run on the CMS files, with how many values were checked and how many had problems.',
    who: 'For anyone auditing the data',
  },
]

const WORKBOOK_SHEETS: [string, string][] = [
  ['Hospital Lookup', 'Choose a hospital and see every number'],
  ['HAC Calculator', 'The safety score worked out step by step'],
  ['Patients to Prevent', 'The infections to prevent math, cell by cell'],
  ['Peer Benchmark', 'How the hospital ranks among similar hospitals'],
  ['HCAHPS', 'Nurse communication compared with similar hospitals'],
  ['Data', 'All hospitals in one table'],
  ['README, DQ Log, Definitions', 'Sources, data checks and a measure dictionary'],
]

const API: { path: string; description: string }[] = [
  { path: 'data/index.json', description: 'Every hospital with its status and biggest opportunity.' },
  { path: 'data/national.json', description: 'National counts, charts and the FY values used to score hospitals.' },
  { path: 'data/manifest.json', description: 'The CMS files used, when CMS updated them and their digital fingerprints.' },
  { path: 'data/accuracy.json', description: 'How closely our rebuild matches the official CMS results.' },
  { path: 'data/dq.json', description: 'Results of the automatic data checks.' },
  { path: 'data/measures.json', description: 'Every measure, its group, the reason for the group, and CMS note codes.' },
]

type Avail = { ok: boolean; size: number | null } | undefined

/** HEAD request for each file so a missing file shows as unavailable instead of a dead link. */
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

function FileCard({ f, avail, featured }: { f: FileDef; avail: Avail; featured?: boolean }) {
  const missing = avail && !avail.ok
  return (
    <article className={`flex flex-col bg-surface p-6 sm:p-8 ${featured ? 'lg:col-span-2' : ''}`}>
      <p className="text-xs text-muted">{f.kind}{avail?.ok && avail.size != null ? `, ${fmtSize(avail.size)}` : ''}</p>
      <h3 className="mt-2 text-xl font-bold leading-snug text-ink">{f.title}</h3>
      <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{f.description}</p>
      {featured && (
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {WORKBOOK_SHEETS.map(([s, d]) => (
            <div key={s} className="text-sm">
              <dt className="font-bold text-ink">{s}</dt>
              <dd className="text-muted">{d}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-primary">{f.who}</p>
      <div className="mt-4">
        {missing
          ? <span className="text-sm text-muted">Not available in this update</span>
          : <ArrowLink href={BASE + f.path} download={f.name}>Download<span className="sr-only"> {f.title}</span></ArrowLink>}
      </div>
    </article>
  )
}

export default function Downloads() {
  const idx = useData(loadIndex)
  const man = useData(loadManifest)
  const avail = useAvailability(FILES.map((f) => f.path))
  const example = idx.status === 'ready' ? (idx.data.find((h) => h.hac != null) ?? idx.data[0]) : null
  const builtAt = man.status === 'ready' ? man.data.built_at : null

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Downloads"
        title="Take the data with you"
        lead={`Everything behind this site is free to download. It is rebuilt from the latest CMS files every week${builtAt ? `, most recently on ${fmtDate(builtAt.slice(0, 10))}` : ''}.`}
        tells="Which files you can download, what is inside each one and who each file is for. Most people want the Excel workbook. Analysts and developers can use the spreadsheets and data files."
      />

      <section aria-label="Files to download" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {FILES.map((f, i) => <FileCard key={f.path} f={f} avail={avail[f.path]} featured={i === 0} />)}
      </section>
      <p className="text-sm text-muted">
        Tip: hospital IDs start with zeros (for example 010001). When opening a spreadsheet in Excel, set the ID column to Text so the zeros are kept.
        The workbook works best in Excel 2021, Microsoft 365 or a recent LibreOffice.
      </p>

      <Panel eyebrow="For developers" title="Data files behind the site"
        intro="These are the same files this website reads. They are free to use, with no sign up or key.">
        <ul className="divide-y divide-border border-y border-border">
          {API.map((a) => (
            <li key={a.path} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div>
                <p className="font-mono text-sm font-semibold text-ink">{a.path}</p>
                <p className="text-sm text-muted">{a.description}</p>
              </div>
              <div className="shrink-0"><ArrowLink href={BASE + a.path} external>Open</ArrowLink></div>
            </li>
          ))}
          <li className="py-4">
            <p className="font-mono text-sm font-semibold text-ink">data/hospitals/[hospital ID].json</p>
            <p className="text-sm text-muted">Everything about one hospital: safety score breakdown, infections to prevent, patient experience and readmissions.</p>
            {example && (
              <div className="mt-2">
                <ArrowLink href={`${BASE}data/hospitals/${example.ccn}.json`} external>Example: {example.name}</ArrowLink>
              </div>
            )}
          </li>
          <li className="py-4">
            <p className="font-mono text-sm font-semibold text-ink">data/peers/[group].json</p>
            <p className="text-sm text-muted">Values for every hospital in one group of similar hospitals, used for the comparison charts.</p>
          </li>
        </ul>
      </Panel>

      <section className="px-6 py-8 text-white sm:px-10" style={{ background: 'rgb(var(--royal, 47 79 158))' }}>
        <Eyebrow><span className="text-white/80">Using this data</span></Eyebrow>
        <h2 className="mt-2 text-2xl font-bold">Free to use, with credit</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-[15px] text-white/90">
          <li>The data is public information from the Centers for Medicare and Medicaid Services (CMS). CMS does not endorse CareSignal.</li>
          <li>Rebuilt scores, infections to prevent, similar hospital groups and measure groups are CareSignal calculations, explained on the How it works page.</li>
          <li>The code is open source under the MIT License.</li>
          <li>Please cite as: CareSignal, built on CMS public data, with the date of the update you used.</li>
        </ul>
      </section>
      <Source>CMS Provider Data Catalog and data.cms.gov</Source>
    </div>
  )
}
