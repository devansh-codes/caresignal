import { useMemo, useState } from 'react'
import { StateView } from '../components/ui'
import { SortableTable, type Column } from '../components/insights/SortableTable'
import { LIMITATIONS, datasetUrl } from '../components/insights/content'
import { ArrowLink, BigStat, PageIntro, Panel, ShowMath, Source, StatRow } from '../components/insights/layout'
import { loadAccuracy, loadDq, loadManifest, useData } from '../lib/data'
import { HAC_LABELS, NA, fmt, fmtDate, fmtInt, fmtPct, fmtPeriod } from '../lib/format'
import type { Accuracy, DqRule, HacMeasureKey, Manifest, SourceEntry } from '../lib/types'

const MEASURES: HacMeasureKey[] = ['psi90', 'clabsi', 'cauti', 'ssi', 'cdi', 'mrsa']
const STALE_MONTHS = 13

/** Optional fields the rebuild adds beyond the base contract (calibrated parameters, tolerance, counts). */
type AccuracyExt = Accuracy & {
  tolerance?: { z: number; total: number }
  z_within_tol_calibrated?: Record<HacMeasureKey, number>
  total_within_tol_calibrated?: number
  flag_agreement_calibrated?: number
  counts?: { penalized_official?: number; not_penalized_official?: number; maryland?: number; flag_evaluated?: number }
  built_at?: string
}

const monthsBetween = (a: string, b: string) => {
  const [x, y] = [new Date(a), new Date(b)]
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()) + (y.getDate() - x.getDate()) / 31
}

export default function DataQuality() {
  const man = useData(loadManifest)
  const acc = useData(loadAccuracy)
  const dq = useData(loadDq)
  const latest = man.status === 'ready'
    ? man.data.sources.map((s) => s.modified).filter((d): d is string => !!d).sort().slice(-1)[0] ?? null
    : null

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="About the data"
        title="Where the numbers come from and how we check them"
        lead="Every number on CareSignal comes from public files published by the Centers for Medicare and Medicaid Services (CMS). The site checks for new files every week."
        tells={<>
          Whether you can trust the numbers (our rebuilt scores against the official CMS results), how recent each data file is, and the automatic
          checks every update must pass. If a check fails, the update is not published and the previous version stays online.
          {latest && <> The newest CMS file was published on <strong className="text-ink">{fmtDate(latest)}</strong>.</>}
        </>}
      />

      {acc.status === 'loading' && <StateView kind="loading" />}
      {acc.status === 'error' && <StateView kind="error" message={`The accuracy check could not be loaded (${acc.error}).`} />}
      {acc.status === 'ready' && <AccuracySection a={acc.data as AccuracyExt} />}

      <Panel eyebrow="How fresh is the data" title="The CMS files we use"
        intro={<>Each row is one public CMS file. Medicare data always runs behind real life, so the period of care is often a year or two old. Files that CMS has not updated in more than {STALE_MONTHS} months are marked <strong className="text-warning">Older</strong>.</>}>
        {man.status === 'loading' && <StateView kind="loading" />}
        {man.status === 'error' && <StateView kind="error" message={`The file list could not be loaded (${man.error}).`} />}
        {man.status === 'ready' && <ManifestTable m={man.data} />}
      </Panel>

      <Panel eyebrow="Automatic checks" title="Every update must pass these checks"
        intro="Before anything is published, a program checks each file: are the expected columns there, are hospital IDs valid, are percentages between 0 and 100, are there duplicates, and so on.">
        {dq.status === 'loading' && <StateView kind="loading" />}
        {dq.status === 'error' && <StateView kind="error" message={`The check results could not be loaded (${dq.error}).`} />}
        {dq.status === 'ready' && <RulesTable rules={dq.data.rules} builtAt={dq.data.built_at}
          names={man.status === 'ready' ? Object.fromEntries(man.data.sources.map((x) => [x.id, x.title])) : {}} />}
      </Panel>

      <Panel eyebrow="Limits" title="What this tool cannot tell you" intro="Read the numbers with these limits in mind.">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LIMITATIONS.map((l) => (
            <li key={l.title} className="bg-surface-2 p-4">
              <p className="font-bold text-ink">{l.title}</p>
              <p className="mt-1 text-sm text-muted">{l.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-5"><ArrowLink to="/methods">How we calculate every number</ArrowLink></div>
      </Panel>
    </div>
  )
}

function AccuracySection({ a }: { a: AccuracyExt }) {
  const tol = a.tolerance?.z ?? 0.001
  const [showAll, setShowAll] = useState(false)
  const mism = showAll ? a.mismatches : a.mismatches.slice(0, 10)
  const flagN = a.counts?.flag_evaluated ?? a.n_scored
  const matched = Math.round(a.flag_agreement * flagN)
  return (
    <Panel eyebrow="Can you trust these numbers" title={`Our rebuild matches CMS penalty decisions for ${fmtPct(a.flag_agreement * 100, 1)} of hospitals`}
      intro={<>CMS publishes the scores but not every step behind them. We rebuilt the FY{a.fiscal_year} safety score from the published inputs and compared it, hospital by hospital, with the official results.</>}>
      <StatRow>
        <BigStat above="Penalty decisions that match" tone={a.flag_agreement >= 0.99 ? 'ok' : 'warning'} value={fmtPct(a.flag_agreement * 100, 1)}
          below={`${fmtInt(matched)} of ${fmtInt(flagN)} hospitals`} />
        <BigStat above="Match using CMS's own settings" value={a.flag_agreement_calibrated != null ? fmtPct(a.flag_agreement_calibrated * 100, 0) : NA}
          below="Every score and decision matches when we use the exact averages CMS used" />
        <BigStat above="Penalty line" value={fmt(a.cutoff_official_inferred, 2)}
          below={`Worked out from the CMS decisions. Our own calculation gives ${fmt(a.cutoff_rebuilt, 2)}.`} />
        <BigStat above="Hospitals checked" value={fmtInt(a.n_hospitals)} below={`${fmtInt(a.n_scored)} of them have a safety score`} />
      </StatRow>

      <h3 className="mt-8 font-bold text-ink">How closely each measure matches</h3>
      <p className="mt-1 text-sm text-muted">
        The share of hospitals where our result for each measure is within {tol} of the CMS value. Two measures fall short because CMS rounds the numbers it
        publishes, while its own calculation used the unrounded values.
      </p>
      <div className="mt-3 overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Share of hospitals whose rebuilt measure result matches CMS, by measure</caption>
          <thead className="bg-surface-2">
            <tr>
              {['Measure', 'Our rebuild', ...(a.z_within_tol_calibrated ? ["With CMS's settings"] : [])].map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink ${i ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEASURES.map((m) => {
              const share = a.z_within_tol[m]
              return (
                <tr key={m} className="border-t border-border/60 text-ink">
                  <th scope="row" className="px-3 py-2.5 text-left font-semibold">{HAC_LABELS[m]}</th>
                  <td className="tabular px-3 py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span aria-hidden className="hidden h-2 w-24 overflow-hidden bg-surface-2 md:inline-block">
                        <span className={`block h-full ${share >= 0.99 ? 'bg-ok' : 'bg-warning'}`} style={{ width: `${(share ?? 0) * 100}%` }} />
                      </span>
                      {share == null ? NA : fmtPct(share * 100, 1)}
                    </span>
                  </td>
                  {a.z_within_tol_calibrated && <td className="tabular px-3 py-2.5 text-right">{fmtPct((a.z_within_tol_calibrated[m] ?? 0) * 100, 0)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ShowMath label="Show technical details">
        {a.notes.length > 0 && (
          <>
            <h4 className="mt-4 text-sm font-bold text-ink">Method notes</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
              {a.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </>
        )}
        <h4 className="mt-5 text-sm font-bold text-ink">
          Values that differ from the official file ({fmtInt(a.mismatches.length)}{a.mismatches.length >= 50 ? ', first 50 listed' : ''})
        </h4>
        {a.mismatches.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None. Every rebuilt value matches the official file.</p>
        ) : (
          <>
            <div className="mt-2 overflow-x-auto border border-border">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">Hospitals where the rebuilt value differs from the official value</caption>
                <thead className="bg-surface-2">
                  <tr>{['Hospital ID', 'Hospital', 'Value', 'CMS', 'Ours'].map((h, i) => (
                    <th key={h} scope="col" className={`px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {mism.map((r, i) => (
                    <tr key={`${r.ccn}${r.field}${i}`} className="border-t border-border/60 text-ink">
                      <td className="px-3 py-1.5 font-mono text-xs">{r.ccn}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.field}</td>
                      <td className="tabular px-3 py-1.5 text-right">{typeof r.official === 'number' ? fmt(r.official, 4) : r.official ?? NA}</td>
                      <td className="tabular px-3 py-1.5 text-right">{typeof r.rebuilt === 'number' ? fmt(r.rebuilt, 4) : r.rebuilt ?? NA}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {a.mismatches.length > 10 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="no-print mt-2 text-sm font-bold text-ink underline">
                {showAll ? 'Show fewer' : `Show all ${a.mismatches.length}`}
              </button>
            )}
          </>
        )}
      </ShowMath>
      <Source>Our rebuild of the CMS Hospital Acquired Condition Reduction Program, FY{a.fiscal_year}, compared with the official CMS file{a.built_at ? `, checked ${fmtDate(a.built_at.slice(0, 10))}` : ''}</Source>
    </Panel>
  )
}

function ManifestTable({ m }: { m: Manifest }) {
  const cols: Column<SourceEntry>[] = [
    {
      key: 'title', header: 'CMS file', sortValue: (s) => s.title,
      render: (s) => (
        <a className="block max-w-xs whitespace-normal font-bold text-ink underline decoration-[rgb(var(--yellow,254_202_113))] decoration-2 underline-offset-4 hover:opacity-80"
          href={datasetUrl(s.id, s.download_url)} target="_blank" rel="noreferrer">{s.title}</a>
      ),
    },
    { key: 'role', header: 'What we use it for', render: (s) => <span className="block max-w-[16rem] whitespace-normal text-muted">{s.role}</span> },
    {
      key: 'modified', header: 'CMS last updated', sortValue: (s) => s.modified,
      render: (s) => {
        const stale = s.modified && monthsBetween(s.modified, m.built_at) > STALE_MONTHS
        return (
          <span className={stale ? 'font-semibold text-warning' : 'text-ink'}>
            {fmtDate(s.modified)}{stale && <span className="ml-2 bg-warning/10 px-1.5 py-0.5 text-[11px] font-bold uppercase">Older</span>}
          </span>
        )
      },
    },
    { key: 'period', header: 'Period of care', render: (s) => <span className="whitespace-nowrap text-ink">{s.period ? fmtPeriod(s.period) : 'Not dated'}</span> },
    { key: 'rows', header: 'Rows', align: 'right', sortValue: (s) => s.rows, render: (s) => fmtInt(s.rows) },
    {
      key: 'http', header: 'Download', align: 'right', sortValue: (s) => s.http_status,
      render: (s) => s.http_status === 200
        ? <span className="font-semibold text-ok">OK</span>
        : <span className="font-semibold text-warning">Problem ({s.http_status})</span>,
    },
  ]
  return (
    <>
      <SortableTable caption="CMS files used" rows={m.sources} columns={cols} rowKey={(s) => s.id} initialSort="title" initialDir="asc" maxHeight={640} />
      <Source>Downloaded on {fmtDate(m.built_at.slice(0, 10))}. Each file's digital fingerprint is recorded in data/manifest.json so any change can be traced.</Source>
    </>
  )
}

const SEV_LABEL = { error: 'Must pass', warn: 'Warning', info: 'For information' } as const

function RulesTable({ rules, builtAt, names }: { rules: DqRule[]; builtAt: string; names: Record<string, string> }) {
  const nameOf = (id: string) => names[id] ?? (id === 'all' || id === '*' ? 'All files' : id.replace(/[_-]/g, ' '))
  const [dataset, setDataset] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const datasets = useMemo(() => Array.from(new Set(rules.map((r) => r.dataset))).sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rules, names])
  const filtered = rules.filter((r) =>
    (dataset === 'all' || r.dataset === dataset) &&
    (severity === 'all' || r.severity === severity) &&
    (status === 'all' || (status === 'pass' ? r.passed : !r.passed)))
  const failedErrors = rules.filter((r) => !r.passed && r.severity === 'error').length
  const failedWarn = rules.filter((r) => !r.passed && r.severity !== 'error').length
  const passed = rules.filter((r) => r.passed).length
  const records = rules.reduce((s, r) => s + r.checked, 0)

  const cols: Column<DqRule>[] = [
    {
      key: 'status', header: 'Result', sortValue: (r) => (r.passed ? 1 : 0),
      render: (r) => r.passed
        ? <span className="inline-flex items-center gap-1 font-semibold text-ok"><span aria-hidden>✓</span>Passed</span>
        : <span className={`inline-flex items-center gap-1 font-bold ${r.severity === 'error' ? 'text-critical' : 'text-warning'}`}><span aria-hidden>!</span>{r.severity === 'error' ? 'Failed' : 'Flagged'}</span>,
    },
    { key: 'description', header: 'What is checked', sortValue: (r) => r.description, render: (r) => <span className="block max-w-md whitespace-normal text-ink">{r.description}</span> },
    { key: 'dataset', header: 'File', sortValue: (r) => nameOf(r.dataset), render: (r) => <span className="block max-w-[12rem] whitespace-normal text-sm text-muted">{nameOf(r.dataset)}</span> },
    { key: 'severity', header: 'Type', sortValue: (r) => r.severity, render: (r) => <span className="text-xs font-bold uppercase text-muted">{SEV_LABEL[r.severity]}</span> },
    { key: 'checked', header: 'Values checked', align: 'right', sortValue: (r) => r.checked, render: (r) => fmtInt(r.checked) },
    { key: 'failed', header: 'Problems', align: 'right', sortValue: (r) => r.failed, render: (r) => fmtInt(r.failed) },
  ]
  const select = (label: string, value: string, set: (v: string) => void, opts: [string, string][]) => (
    <label className="flex min-w-0 max-w-full flex-col gap-1 text-xs font-bold uppercase tracking-wide text-ink">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}
        className="w-full max-w-[18rem] truncate rounded-[2px] border border-border bg-surface px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
  return (
    <>
      <div className="mb-6">
        <StatRow>
          <BigStat above="Checks" value={fmtInt(rules.length)} below={`${fmtInt(records)} values checked in all`} />
          <BigStat above="Passed" tone="ok" value={fmtInt(passed)} below={`${fmtPct((passed / Math.max(rules.length, 1)) * 100, 0)} of checks`} />
          <BigStat above="Blocking problems" tone={failedErrors ? 'critical' : 'ink'} value={fmtInt(failedErrors)} below="Any problem here stops the update" />
          <BigStat above="Warnings" tone={failedWarn ? 'warning' : 'ink'} value={fmtInt(failedWarn)} below="Noted and reviewed, but not blocking" />
        </StatRow>
      </div>
      <div className="no-print mb-4 flex flex-wrap items-end gap-4" role="group" aria-label="Filter the checks">
        {select('File', dataset, setDataset, [['all', 'All files'], ...datasets.map((d) => [d, nameOf(d)] as [string, string])])}
        {select('Type', severity, setSeverity, [['all', 'All types'], ['error', SEV_LABEL.error], ['warn', SEV_LABEL.warn], ['info', SEV_LABEL.info]])}
        {select('Result', status, setStatus, [['all', 'All results'], ['pass', 'Passed'], ['fail', 'Not passed']])}
        <p className="pb-2 text-sm text-muted" aria-live="polite">Showing {fmtInt(filtered.length)} of {fmtInt(rules.length)} checks</p>
      </div>
      <SortableTable caption="Automatic checks" rows={filtered} columns={cols} rowKey={(r) => r.rule_id} initialSort="status" initialDir="asc" maxHeight={560} />
      <Source>CareSignal check log, run {fmtDate(builtAt.slice(0, 10))}</Source>
    </>
  )
}
