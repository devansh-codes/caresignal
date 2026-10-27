import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const CMS_LINKS = [
  { href: 'https://www.cms.gov/medicare/quality/value-based-programs/hospital-acquired-conditions', label: 'CMS Hospital Acquired Condition Reduction Program' },
  { href: 'https://data.cms.gov/provider-data/topics/hospitals', label: 'CMS Provider Data Catalog: Hospitals' },
  { href: 'https://hcahpsonline.org/en/hcahps-and-hospital-vbp/', label: 'HCAHPS patient survey and Value Based Purchasing' },
  { href: 'https://www.cms.gov/medicare/quality/value-based-programs/hospital-readmissions', label: 'Hospital Readmissions Reduction Program' },
]

const EXPLORE = [
  { to: '/hospitals', label: 'Find a hospital' },
  { to: '/insights', label: 'National insights' },
  { to: '/methods', label: 'How it works' },
  { to: '/data-quality', label: 'About the data' },
  { to: '/downloads', label: 'Downloads' },
]

export function Footer() {
  return (
    <footer className="no-print mt-16 bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <div className="bg-royal px-6 py-10 text-white sm:px-12">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 className="text-2xl font-medium sm:text-3xl">Look up any hospital in seconds.</h2>
              <p className="mt-2 max-w-xl text-white/85">
                Search by name, city or state to see where it stands and which infections matter most.
              </p>
            </div>
            <Link to="/hospitals" className="inline-flex justify-center rounded-sm bg-yellow px-6 py-3 font-bold text-[#112659] hover:brightness-95">
              Find a hospital
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-10 py-12 text-[15px] sm:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 leading-relaxed text-body">
              An independent look at public CMS data. Not affiliated with CMS. Estimates are approximate and assume other
              hospitals and the penalty line stay the same.
            </p>
          </div>
          <nav aria-label="Footer">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-royal dark:text-primary">Explore</h2>
            <ul className="space-y-2.5">
              {EXPLORE.map((l) => (
                <li key={l.to}><Link className="text-ink hover:underline hover:decoration-yellow hover:decoration-2 hover:underline-offset-4" to={l.to}>{l.label}</Link></li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-royal dark:text-primary">Public sources</h2>
            <ul className="space-y-2.5">
              {CMS_LINKS.map((l) => (
                <li key={l.href}>
                  <a className="text-ink hover:underline hover:decoration-yellow hover:decoration-2 hover:underline-offset-4" href={l.href} target="_blank" rel="noreferrer">
                    {l.label} <span aria-hidden>↗</span>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-rule py-5 text-xs text-muted sm:flex-row">
          <span>Built only on public CMS data. No patient level data. Not medical or financial advice.</span>
          <span className="flex items-center gap-2">Display <ThemeToggle /></span>
        </div>
      </div>
    </footer>
  )
}
