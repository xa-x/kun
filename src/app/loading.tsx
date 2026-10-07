export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="kun-atmosphere flex min-h-dvh items-center justify-center"
    >
      <span className="kun-eq text-ink" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
