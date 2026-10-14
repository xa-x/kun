"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/community", label: "Community" },
  { href: "/admin/models", label: "Models" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

/** Sections of the operator console. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="border-b border-line">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 md:px-10" dir="ltr">
        {ITEMS.map((i) => {
          const active = "exact" in i && i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex h-12 items-center border-b-2 px-4 text-[13.5px] transition-colors ${
                  active ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
