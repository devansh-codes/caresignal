export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-7 w-7 shrink-0">
        <rect width="32" height="32" rx="7" className="fill-primary" />
        <path
          d="M5 17h5l3-7 5 13 3-6h6"
          fill="none"
          className="stroke-primary-ink"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-ink">
        Care<span className="text-primary">Signal</span>
      </span>
    </span>
  )
}
