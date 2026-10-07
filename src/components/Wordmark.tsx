/**
 * Brand mark: three nodes joined by two wires, each node in the colour of a
 * data type. Paired with كُن ("Be!") set in Kufic.
 */
export function Logomark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M6.2 8.2 11.7 5M6.2 9.8l5.5 3.2"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="4.2" cy="9" r="2.6" fill="var(--color-t-text)" />
      <circle cx="13.8" cy="4.4" r="2.6" fill="var(--color-t-image)" />
      <circle cx="13.8" cy="13.6" r="2.6" fill="var(--color-t-video)" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-ink" title="كُن · Kun">
      <Logomark />
      {!compact && (
        <span className="flex items-baseline gap-1.5">
          <span
            lang="ar"
            dir="rtl"
            className="font-arabic text-[17px] font-bold leading-none"
          >
            كُن
          </span>
          <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">
            KUN
          </span>
        </span>
      )}
    </span>
  );
}
