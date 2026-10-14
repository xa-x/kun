"use client";

import type { ReactNode } from "react";

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-9 md:px-10" dir="ltr">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "err" }) {
  return (
    <div className="rounded-2xl border border-line bg-card/60 p-4">
      <p className="text-[12px] text-faint">{label}</p>
      <p className={`mt-1.5 font-mono text-[24px] tabular-nums tracking-tight ${tone === "err" ? "text-err" : tone === "warn" ? "text-warn" : "text-ink"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="kun-input !h-10 !max-w-xs !rounded-full !text-[13px]"
    />
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="border-b border-line bg-card/60 text-[12px] text-faint">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-[13px] text-muted">{empty}</p>}
    </div>
  );
}

export const Badge = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "ok" | "warn" }) => (
  <span
    className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] capitalize ${
      tone === "ok" ? "bg-ok/15 text-ok" : tone === "warn" ? "bg-warn/15 text-warn" : "bg-ink/10 text-muted"
    }`}
  >
    {children}
  </span>
);

export const fmtMB = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`);
export const usd = (n: number) => `$${n.toFixed(n < 10 ? 2 : 0)}`;
