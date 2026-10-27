/** Wordmark in the reference style: line drawn bars icon, bold name, spaced caps suffix, small tagline. */
export function Logo({ className = '', tagline = true, inverse = false }: { className?: string; tagline?: boolean; inverse?: boolean }) {
  const ink = inverse ? 'text-white' : 'text-ink'
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg aria-hidden viewBox="0 0 44 40" className="h-9 w-10 shrink-0 sm:h-11 sm:w-12">
        <g fill="none" stroke="#FECA71" strokeWidth="2">
          <rect x="6" y="14" width="9" height="22" rx="1" />
          <rect x="18" y="4" width="9" height="32" rx="1" />
          <rect x="30" y="20" width="9" height="16" rx="1" />
        </g>
        <path d="M1 30h10l4 -8 6 12 4 -6h18" fill="none" stroke={inverse ? '#fff' : '#2F4F9E'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="leading-none">
        <span className={`block text-lg font-bold sm:text-xl ${ink}`}>
          CareSignal <span className="ml-0.5 hidden text-base font-normal uppercase tracking-[0.22em] sm:inline">Dashboard</span>
        </span>
        {tagline && <span className={`mt-1.5 hidden text-[13px] sm:block ${inverse ? 'text-white/80' : 'text-body'}`}>Medicare safety penalties, explained</span>}
      </span>
    </span>
  )
}
