import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/** Chrome for everything a signed-out visitor sees: header, page, footer. */
export function MarketingShell({
  signedIn,
  children,
}: {
  signedIn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="kun-atmosphere relative flex min-h-dvh flex-col">
      <div className="kun-grain" aria-hidden />
      <SiteHeader signedIn={signedIn} />
      <main className="relative z-10 flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
