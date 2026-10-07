import type { ReactNode } from "react";

/** Title block shared by every workspace page. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
