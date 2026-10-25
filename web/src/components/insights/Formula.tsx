import type { ReactNode } from 'react'

/** Styled formula block: monospace, readable, copyable. No math-typesetting dependency. */
export function Formula({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <figure className="my-3">
      <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 px-4 py-3 font-mono text-[13px] leading-relaxed text-ink">{children}</pre>
      {label && <figcaption className="mt-1 text-xs text-muted">{label}</figcaption>}
    </figure>
  )
}
