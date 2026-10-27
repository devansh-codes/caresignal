import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { SearchBar } from '../search/SearchBar'
import { Footer } from './Footer'
import { FreshnessBanner } from './FreshnessBanner'
import { Logo } from './Logo'

/** Sidebar items: icon above a tiny uppercase label, like the reference site's navy rail. */
const NAV: { to: string; label: string; short: string; end?: boolean; icon: string }[] = [
  { to: '/', label: 'Home', short: 'Home', end: true, icon: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10' },
  { to: '/hospitals', label: 'All hospitals', short: 'Hospitals', icon: 'M4 21V7l8-4 8 4v14M9 21v-5h6v5M11 9h2M12 8v2' },
  { to: '/insights', label: 'National insights', short: 'Insights', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/methods', label: 'How it works', short: 'How it works', icon: 'M5 3h11l3 3v15H5zM8 9h8M8 13h8M8 17h5' },
  { to: '/data-quality', label: 'About the data', short: 'Data', icon: 'M4 5h16v4H4zM4 10h16v4H4zM4 15h16v4H4z' },
  { to: '/downloads', label: 'Downloads', short: 'Downloads', icon: 'M12 3v12M7 10l5 5 5-5M4 20h16' },
]
const SEARCH_ICON = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4'

function Icon({ d, className = 'h-6 w-6' }: { d: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

/** "Find a hospital" overlay, modeled on the reference site's city picker. */
function SearchDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/70 px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="find-title" className="relative w-full max-w-2xl bg-surface p-6 shadow-2xl sm:p-10">
        <button type="button" onClick={onClose} aria-label="Close search" className="absolute right-4 top-4 p-2 text-ink">
          <Icon d="M5 5l14 14M19 5 5 19" className="h-7 w-7" />
        </button>
        <h2 id="find-title" className="pr-10 text-2xl font-bold text-ink sm:text-3xl">Find a hospital</h2>
        <p className="mt-2 text-body">Start typing a hospital name, city or state. Pick a result to open its profile.</p>
        <div className="mt-6">
          <SearchBar size="lg" autoFocus label="Find a hospital" onNavigate={onClose} />
        </div>
        <p className="mt-6 text-sm text-body">
          Prefer to browse? <Link to="/hospitals" onClick={onClose} className="font-bold text-ink underline decoration-yellow decoration-2 underline-offset-4">See the full list of hospitals</Link>
        </p>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const { pathname } = useLocation()

  // New route: close overlays and start at the top of the page.
  useEffect(() => {
    setMenuOpen(false)
    setFindOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const railLink = ({ isActive }: { isActive: boolean }) =>
    `relative flex flex-col items-center gap-1 px-1 py-3.5 text-center text-[9.5px] font-bold uppercase leading-tight tracking-wide transition ${
      isActive ? 'bg-white/10 text-white before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-yellow' : 'text-white/85 hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="no-print sr-only z-[70] bg-yellow px-3 py-2 font-bold text-[#112659] focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Top bar: menu square, wordmark with tagline, yellow call to action. */}
      <header className="no-print sticky top-0 z-40 border-b border-navy bg-surface">
        <div className="flex h-16 items-stretch sm:h-[88px]">
          <button
            type="button"
            className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 text-ink sm:w-[72px] lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon d={menuOpen ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} className="h-7 w-7" />
            <span className="text-[9px] font-bold uppercase">{menuOpen ? 'Close' : 'Menu'}</span>
          </button>
          <div className="hidden w-[72px] shrink-0 lg:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-4 pr-3 sm:pr-8 lg:pl-8">
            <Link to="/" aria-label="CareSignal home" className="min-w-0 shrink">
              <Logo />
            </Link>
            <button
              type="button"
              onClick={() => setFindOpen(true)}
              className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-sm bg-yellow px-3 py-2.5 text-sm font-bold text-[#112659] hover:brightness-95 sm:px-6 sm:py-3 sm:text-base"
            >
              <Icon d={SEARCH_ICON} className="h-5 w-5" />
              <span className="hidden sm:inline">Find a hospital</span>
              <span className="sm:hidden">Find</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-nav" className="absolute inset-x-0 top-full max-h-[calc(100vh-4rem)] overflow-auto bg-navy px-4 pb-6 pt-2 shadow-xl lg:hidden">
            <nav aria-label="Primary (mobile)" className="grid grid-cols-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `flex items-center gap-4 border-b border-white/10 px-2 py-4 text-lg font-bold ${isActive ? 'text-yellow' : 'text-white'}`}
                >
                  <Icon d={n.icon} />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Fixed navy rail on desktop. */}
      <nav aria-label="Primary" className="no-print fixed bottom-0 left-0 top-[88px] z-30 hidden w-[72px] flex-col bg-navy pt-4 lg:flex">
        <button type="button" onClick={() => setFindOpen(true)} className={railLink({ isActive: false })}>
          <Icon d={SEARCH_ICON} />
          Find a hospital
        </button>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={railLink} title={n.label}>
            <Icon d={n.icon} />
            {n.short}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 flex-col lg:pl-[72px]">
        <FreshnessBanner />
        <main id="main" tabIndex={-1} className="mx-auto w-full min-h-[100svh] max-w-[1200px] flex-1 px-4 py-8 focus:outline-none sm:px-8 sm:py-12">
          {children}
        </main>
        <Footer />
      </div>

      {findOpen && <SearchDialog onClose={() => setFindOpen(false)} />}
    </div>
  )
}
