/**
 * The Make My Marriage mark: two interlocked rings (two people, one wedding). The first ring takes
 * the surrounding text colour, so it reads on the cream pages (green) and on the dark green panels
 * (cream); the second is always the brand terracotta. The favicon (src/app/icon.svg) is the same
 * drawing on a green tile.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" className={className}>
      <circle cx="20" cy="16" r="8" stroke="#B5714A" strokeWidth="2.6" />
      <circle cx="12" cy="16" r="8" stroke="currentColor" strokeWidth="2.6" />
      {/* Where the rings cross, the left ring passes over the right one at the top and under it at the bottom. */}
      <path d="M16 9.1a8 8 0 0 1 0 13.8" stroke="#B5714A" strokeWidth="2.6" />
    </svg>
  );
}
