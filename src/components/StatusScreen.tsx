import type { ReactNode } from "react";
import { Logomark } from "./Wordmark";

export function StatusScreen({
  kicker,
  title,
  body,
  action,
}: {
  kicker: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <main className="kun-atmosphere relative flex min-h-dvh items-center justify-center px-6">
      <div className="kun-grain" aria-hidden />
      <div className="relative z-10 w-full max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-card/70">
          <Logomark size={22} />
        </span>
        <p className="mt-6 text-[13px] font-medium text-faint">{kicker}</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{body}</p>
        {action && <div className="mt-7 flex justify-center">{action}</div>}
      </div>
    </main>
  );
}
