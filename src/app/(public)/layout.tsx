import { PublicHeader } from "@/components/PublicHeader";

/**
 * Shared chrome for pages reachable without an account (templates gallery,
 * pricing). The share view /s/[token] deliberately stays outside this group —
 * it's a standalone full-bleed page.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="kun-atmosphere relative flex min-h-dvh flex-col">
      <div className="kun-grain" aria-hidden />
      <PublicHeader />
      {children}
    </div>
  );
}
