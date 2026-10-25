import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { SearchBar } from '../search/SearchBar'
import { Footer } from './Footer'
import { FreshnessBanner } from './FreshnessBanner'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/hospitals', label: 'Hospitals' },
  { to: '/insights', label: 'National Insights' },
  { to: '/methods', label: 'Methodology' },
  { to: '/data-quality', label: 'Data Quality' },
  { to: '/downloads', label: 'Downloads' },
]

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink'
  }`

export default function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // New route: close the drawer and start at the top of the page.
  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="no-print sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/" aria-label="CareSignal home" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="ml-4 hidden items-center gap-0.5 xl:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden w-64 md:block lg:w-80 xl:w-56">
            <SearchBar size="sm" label="Search hospitals (header)" />
          </div>
          <div className="ml-auto hidden md:ml-0 md:block">
            <ThemeToggle />
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-ink md:ml-0 xl:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-nav" className="border-t border-border bg-surface px-4 pb-4 pt-3 xl:hidden">
            <div className="md:hidden">
              <SearchBar size="md" label="Search hospitals (menu)" onNavigate={() => setMenuOpen(false)} />
            </div>
            <nav aria-label="Primary (mobile)" className="mt-3 grid grid-cols-1 gap-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm text-muted md:hidden">
              Theme
              <ThemeToggle />
            </div>
          </div>
        )}
      </header>

      <FreshnessBanner />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl min-h-[100svh] flex-1 px-4 py-6 focus:outline-none sm:py-8">
        {children}
      </main>

      <Footer />
    </div>
  )
}
