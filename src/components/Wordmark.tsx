/**
 * Brand mark: the letter nun (ن) from كُن ("Be!"), a bold bowl with the
 * spark where its dot sits — the thing spoken into being.
 */
export function Logomark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M4.5 11.5C4.5 17 8 19.2 12 19.2C16.2 19.2 18.8 16.6 18.8 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="11.8" cy="5.2" r="2.6" fill="var(--color-t-image)" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-ink" title="كُن · Kun">
      <Logomark size={24} />
      {!compact && (
        <>
          {/* Arabic readers get the name as written, with its vowel marks. */}
          <span className="text-[17px] font-semibold leading-none tracking-[-0.01em] [html[dir=rtl]_&]:hidden">
            Kun
          </span>
          <span className="hidden font-[family-name:var(--font-kufi)] text-[21px] font-semibold leading-none [html[dir=rtl]_&]:inline">
            كُن
          </span>
        </>
      )}
    </span>
  );
}
