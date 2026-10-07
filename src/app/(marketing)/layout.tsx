import { MarketingShell } from "@/components/marketing/MarketingShell";

/** The landing page. Static, so the header discovers the session client-side. */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MarketingShell>{children}</MarketingShell>;
}
