import { Link } from 'react-router-dom'
import { Logo } from './Logo'

const CMS_LINKS = [
  { href: 'https://www.cms.gov/medicare/quality/value-based-programs/hospital-acquired-conditions', label: 'CMS HAC Reduction Program' },
  { href: 'https://data.cms.gov/provider-data/topics/hospitals', label: 'CMS Provider Data Catalog — Hospitals' },
  { href: 'https://hcahpsonline.org/en/hcahps-and-hospital-vbp/', label: 'HCAHPS and Hospital VBP' },
  { href: 'https://www.cms.gov/medicare/quality/value-based-programs/hospital-readmissions', label: 'Hospital Readmissions Reduction Program' },
]

export function Footer() {
  return (
    <footer className="no-print mt-12 border-t border-border bg-surface">
      <div className="mx-auto grid grid-cols-1 max-w-7xl gap-8 px-4 py-8 text-sm sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-muted">
            Independent analysis of public CMS data; not affiliated with CMS. Estimates are approximate and hold peer
            performance and the cutoff constant.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Explore</h2>
          <ul className="space-y-1.5">
            <li><Link className="text-ink hover:text-primary" to="/hospitals">Hospital directory</Link></li>
            <li><Link className="text-ink hover:text-primary" to="/insights">National insights</Link></li>
            <li><Link className="text-ink hover:text-primary" to="/methods">Methodology</Link></li>
            <li><Link className="text-ink hover:text-primary" to="/data-quality">Data quality</Link></li>
            <li><Link className="text-ink hover:text-primary" to="/downloads">Downloads</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Public sources</h2>
          <ul className="space-y-1.5">
            {CMS_LINKS.map((l) => (
              <li key={l.href}>
                <a className="text-ink hover:text-primary" href={l.href} target="_blank" rel="noreferrer">
                  {l.label} <span aria-hidden>↗</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-3 text-center text-xs text-muted">
        Built only on public CMS data · No patient-level data · Not medical or financial advice
      </div>
    </footer>
  )
}
