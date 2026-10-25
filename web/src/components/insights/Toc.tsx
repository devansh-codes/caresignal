import { useEffect, useState } from 'react'

/**
 * Sticky in-page table of contents. Uses scrollIntoView rather than '#id' links,
 * because the app runs under a HashRouter and a bare hash would change the route.
 */
export function Toc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id)
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    items.forEach((i) => {
      const el = document.getElementById(i.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [items])
  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }
  return (
    <nav aria-label="On this page" className="no-print">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
      <ul className="space-y-0.5 border-l border-border">
        {items.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => go(i.id)} aria-current={active === i.id ? 'location' : undefined}
              className={`-ml-px block w-full border-l-2 py-1 pl-3 text-left text-sm transition ${active === i.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted hover:text-ink'}`}>
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
