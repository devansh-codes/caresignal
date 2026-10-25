import { useMemo, useState } from 'react'
import { Card, KpiTile, PageHeader, SourceNote, StateView } from '../components/ui'
import { SortableTable, type Column } from '../components/insights/SortableTable'
import { LIMITATIONS, datasetUrl } from '../components/insights/content'
import { loadAccuracy, loadDq, loadManifest, useData } from '../lib/data'
import { HAC_LABELS, fmt, fmtDate, fmtInt, fmtPct, fmtPeriod } from '../lib/format'
import type { Accuracy, DqRule, HacMeasureKey, Manifest, SourceEntry } from '../lib/types'

const MEASURES: HacMeasureKey[] = ['psi90', 'clabsi', 'cauti', 'ssi', 'cdi', 'mrsa']
const STALE_MONTHS = 13

/** Optional fields the rebuild may add beyond the base contract (calibrated parameters, tolerance, conventions). */
type AccuracyExt = Accuracy & {
  tolerance?: { z: number; total: number }
  z_within_tol_calibrated?: Record<HacMeasureKey, number>
  max_abs_z_diff_calibrated?: Record<HacMeasureKey, number>
  total_within_tol_calibrated?: number
  flag_agreement_calibrated?: number
  max_abs_total_diff?: number
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
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trust & transparency"
        title="Data quality"
        description="Every source file, its freshness, every validation rule the pipeline enforces, and how closely the rebuilt HAC scores match CMS's official values. A build that fails an error-level rule or the rebuild tolerance is not deployed, and the previous site stays live."
      />
      {acc.status === 'loading' && <StateView kind="loading" />}
      {acc.status === 'error' && <StateView kind="error" message={`HAC rebuild accuracy could not be loaded (${acc.error}).`} />}
      {acc.status === 'ready' && <AccuracySection a={acc.data as AccuracyExt} />}

      <Card title="Source manifest" subtitle={`Each CMS file as fetched by this build. Sources last modified more than ${STALE_MONTHS} months before the build are flagged as stale.`}>
        {man.status === 'loading' && <StateView kind="loading" />}
        {man.status === 'error' && <StateView kind="error" message={`The source manifest could not be loaded (${man.error}).`} />}
        {man.status === 'ready' && <ManifestTable m={man.data} />}
      </Card>

      <Card title="Validation rules" subtitle="Schema, CCN format, footnote and missing-value handling, ranges and duplicates, checked on every build.">
        {dq.status === 'loading' && <StateView kind="loading" />}
        {dq.status === 'error' && <StateView kind="error" message={`The validation log could not be loaded (${dq.error}).`} />}
        {dq.status === 'ready' && <RulesTable rules={dq.data.rules} builtAt={dq.data.built_at} />}
      </Card>

      <Card title="Known limitations" subtitle="Stated openly so the numbers are read in context.">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LIMITATIONS.map((l) => (
            <li key={l.title} className="rounded-md border border-border bg-surface-2/40 p-3">
              <p className="text-sm font-semibold">{l.title}</p>
              <p className="mt-0.5 text-sm text-muted">{l.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function AccuracySection({ a }: { a: AccuracyExt }) {
  const tol = a.tolerance?.z ?? 0.001
  const flagTone = a.flag_agreement >= 0.99 ? 'ok' : 'warning'
  const src = `Rebuild of CMS HAC Reduction Program FY${a.fiscal_year} (${a.source}) vs. its official values${a.built_at ? ` · built ${fmtDate(a.built_at.slice(0, 10))}` : ''}`
  const [showAll, setShowAll] = useState(false)
  const mism = showAll ? a.mismatches : a.mismatches.slice(0, 10)
  return (
    <Card title="HAC rebuild accuracy"
      subtitle={`The CMS methodology is recalculated from published measure values and compared hospital by hospital with the official z-scores, totals and payment-reduction flags. Target: ≥99% flag agreement and z-scores within ±${tol}.`}>
      <div className="grid grid-cols-1 grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Penalty-flag agreement" tone={flagTone} value={fmtPct(a.flag_agreement * 100, 1)}
          context={a.counts?.flag_evaluated ? `${fmtInt(a.counts.flag_evaluated)} hospitals with an official flag` : `${fmtInt(a.n_scored)} scored hospitals`} />
        <KpiTile label="Total score within tolerance" value={fmtPct(a.total_within_tol * 100, 1)}
          context={a.total_within_tol_calibrated != null ? `${fmtPct(a.total_within_tol_calibrated * 100, 1)} with calibrated parameters` : `±${tol} of official`} />
        <KpiTile label="Cutoff (75th pct)" value={fmt(a.cutoff_rebuilt, 4)}
          context={`Rebuilt · official inferred ${fmt(a.cutoff_official_inferred, 4)}`}
          info="CMS does not publish the cutoff. It is inferred from the official payment-reduction flags as the midpoint between the highest unpenalized and the lowest penalized Total HAC Score." />
        <KpiTile label="Hospitals in file" value={fmtInt(a.n_hospitals)} context={`${fmtInt(a.n_scored)} with a Total HAC Score`} />
      </div>

      <h3 className="mt-6 text-sm font-semibold">Per-measure z-score agreement</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-max text-sm">
          <caption className="sr-only">Share of hospitals whose rebuilt z-score is within tolerance of the official value, by measure</caption>
          <thead className="bg-surface-2">
            <tr>
              {['Measure', `Within ±${tol}`, 'Max |Δz|', ...(a.z_within_tol_calibrated ? [`Within ±${tol} (calibrated)`, 'Max |Δz| (calibrated)'] : [])].map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${i ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEASURES.map((m) => {
              const share = a.z_within_tol[m]
              return (
                <tr key={m} className="border-t border-border/60">
                  <th scope="row" className="px-3 py-2 text-left font-medium">{HAC_LABELS[m]}</th>
                  <td className="tabular px-3 py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span aria-hidden className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-surface-2 sm:inline-block">
                        <span className={`block h-full rounded-full ${share >= 0.99 ? 'bg-ok' : 'bg-warning'}`} style={{ width: `${(share ?? 0) * 100}%` }} />
                      </span>
                      {share == null ? '—' : fmtPct(share * 100, 1)}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2 text-right">{fmt(a.max_abs_z_diff[m], 6)}</td>
                  {a.z_within_tol_calibrated && <td className="tabular px-3 py-2 text-right">{fmtPct((a.z_within_tol_calibrated[m] ?? 0) * 100, 1)}</td>}
                  {a.max_abs_z_diff_calibrated && <td className="tabular px-3 py-2 text-right">{fmt(a.max_abs_z_diff_calibrated[m], 6)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {a.notes.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Method notes</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
            {a.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Disagreements with the official file ({fmtInt(a.mismatches.length)}{a.mismatches.length >= 50 ? ', first 50 listed' : ''})</h3>
        {a.mismatches.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None. Every rebuilt value matches the official file within tolerance.</p>
        ) : (
          <>
            <div className="mt-2 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-max text-sm">
                <caption className="sr-only">Hospitals where the rebuilt value differs from the official value</caption>
                <thead className="bg-surface-2">
                  <tr>{['CCN', 'Hospital', 'Field', 'Official', 'Rebuilt'].map((h, i) => (
                    <th key={h} scope="col" className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {mism.map((r, i) => (
                    <tr key={`${r.ccn}-${r.field}-${i}`} className="border-t border-border/60">
                      <td className="px-3 py-1.5 font-mono text-xs">{r.ccn}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.field}</td>
                      <td className="tabular px-3 py-1.5 text-right">{typeof r.official === 'number' ? fmt(r.official, 4) : r.official ?? '—'}</td>
                      <td className="tabular px-3 py-1.5 text-right">{typeof r.rebuilt === 'number' ? fmt(r.rebuilt, 4) : r.rebuilt ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {a.mismatches.length > 10 && (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="no-print mt-2 text-sm font-medium text-primary hover:underline">
                {showAll ? 'Show fewer' : `Show all ${a.mismatches.length}`}
              </button>
            )}
          </>
        )}
      </div>
      <SourceNote>{src}</SourceNote>
    </Card>
  )
}

function ManifestTable({ m }: { m: Manifest }) {
  const cols: Column<SourceEntry>[] = [
    {
      key: 'title', header: 'Dataset', sortValue: (s) => s.title,
      render: (s) => (
        <div className="max-w-xs whitespace-normal">
          <a className="font-medium text-primary hover:underline" href={datasetUrl(s.id, s.download_url)} target="_blank" rel="noreferrer">{s.title}</a>
          <div className="font-mono text-[11px] text-muted">{s.id}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Used for', render: (s) => <span className="block max-w-[15rem] whitespace-normal text-muted">{s.role}</span> },
    {
      key: 'modified', header: 'CMS modified', sortValue: (s) => s.modified,
      render: (s) => {
        const stale = s.modified && monthsBetween(s.modified, m.built_at) > STALE_MONTHS
        return (
          <span className={stale ? 'font-medium text-warning' : ''}>
            {fmtDate(s.modified)}{stale && <span className="ml-1.5 rounded bg-warning/10 px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-warning/30">Stale</span>}
          </span>
        )
      },
    },
    { key: 'period', header: 'Reporting period', render: (s) => <span className="whitespace-nowrap">{fmtPeriod(s.period)}</span> },
    { key: 'rows', header: 'Rows', align: 'right', sortValue: (s) => s.rows, render: (s) => fmtInt(s.rows) },
    {
      key: 'http', header: 'HTTP', align: 'right', sortValue: (s) => s.http_status,
      render: (s) => <span className={s.http_status === 200 ? 'text-ok' : 'font-semibold text-warning'}>{s.http_status}</span>,
    },
    { key: 'sha', header: 'SHA-256', render: (s) => <span className="font-mono text-[11px] text-muted" title={s.sha256}>{s.sha256.slice(0, 12)}…</span> },
  ]
  return (
    <>
      <SortableTable caption="Source manifest" rows={m.sources} columns={cols} rowKey={(s) => s.id} initialSort="title" initialDir="asc" maxHeight={640} />
      <SourceNote>Build manifest generated {fmtDate(m.built_at.slice(0, 10))}{m.git_sha ? ` · commit ${m.git_sha.slice(0, 7)}` : ''}</SourceNote>
    </>
  )
}

function RulesTable({ rules, builtAt }: { rules: DqRule[]; builtAt: string }) {
  const [dataset, setDataset] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [status, setStatus] = useState('all')
  const datasets = useMemo(() => Array.from(new Set(rules.map((r) => r.dataset))).sort(), [rules])
  const filtered = rules.filter((r) =>
    (dataset === 'all' || r.dataset === dataset) &&
    (severity === 'all' || r.severity === severity) &&
    (status === 'all' || (status === 'pass' ? r.passed : !r.passed)))
  const failedErrors = rules.filter((r) => !r.passed && r.severity === 'error').length
  const failedWarn = rules.filter((r) => !r.passed && r.severity !== 'error').length
  const passed = rules.filter((r) => r.passed).length
  const records = rules.reduce((s, r) => s + r.checked, 0)

  const sevCls = { error: 'text-ink', warn: 'text-warning', info: 'text-muted' } as const
  const cols: Column<DqRule>[] = [
    {
      key: 'status', header: 'Result', sortValue: (r) => (r.passed ? 1 : 0),
      render: (r) => r.passed
        ? <span className="inline-flex items-center gap-1 text-ok"><span aria-hidden>✓</span>Pass</span>
        : <span className={`inline-flex items-center gap-1 font-semibold ${r.severity === 'error' ? 'text-critical' : 'text-warning'}`}><span aria-hidden>!</span>{r.severity === 'error' ? 'Fail' : 'Flagged'}</span>,
    },
    { key: 'dataset', header: 'Dataset', sortValue: (r) => r.dataset, render: (r) => <span className="font-mono text-xs">{r.dataset}</span> },
    { key: 'description', header: 'Rule', sortValue: (r) => r.description, render: (r) => <span className="block max-w-md whitespace-normal">{r.description}</span> },
    { key: 'severity', header: 'Severity', sortValue: (r) => r.severity, render: (r) => <span className={`text-xs font-semibold uppercase ${sevCls[r.severity]}`}>{r.severity}</span> },
    { key: 'checked', header: 'Checked', align: 'right', sortValue: (r) => r.checked, render: (r) => fmtInt(r.checked) },
    { key: 'failed', header: 'Failed', align: 'right', sortValue: (r) => r.failed, render: (r) => fmtInt(r.failed) },
  ]
  const select = (label: string, value: string, set: (v: string) => void, opts: [string, string][]) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink">
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
  return (
    <>
      <div className="mb-4 grid grid-cols-1 grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Rules" value={fmtInt(rules.length)} context={`${fmtInt(records)} values checked`} />
        <KpiTile label="Passed" tone="ok" value={fmtInt(passed)} context={fmtPct((passed / Math.max(rules.length, 1)) * 100, 1)} />
        <KpiTile label="Blocking failures" tone={failedErrors ? 'critical' : 'neutral'} value={fmtInt(failedErrors)} context="Error-level rules; any failure blocks deploy" />
        <KpiTile label="Warnings" tone={failedWarn ? 'warning' : 'neutral'} value={fmtInt(failedWarn)} context="Logged, reviewed, not blocking" />
      </div>
      <div className="no-print mb-3 flex flex-wrap items-end gap-3" role="group" aria-label="Filter validation rules">
        {select('Dataset', dataset, setDataset, [['all', 'All datasets'], ...datasets.map((d) => [d, d] as [string, string])])}
        {select('Severity', severity, setSeverity, [['all', 'All'], ['error', 'Error'], ['warn', 'Warning'], ['info', 'Info']])}
        {select('Result', status, setStatus, [['all', 'All'], ['pass', 'Passed'], ['fail', 'Not passed']])}
        <p className="pb-1.5 text-sm text-muted" aria-live="polite">{fmtInt(filtered.length)} of {fmtInt(rules.length)} rules</p>
      </div>
      <SortableTable caption="Validation rules" rows={filtered} columns={cols} rowKey={(r) => r.rule_id} initialSort="status" initialDir="asc" maxHeight={560} />
      <SourceNote>CareSignal validation log (dq_log.csv) · built {fmtDate(builtAt.slice(0, 10))}</SourceNote>
    </>
  )
}
