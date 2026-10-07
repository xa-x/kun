import Link from "next/link";
import Image from "next/image";
import { Wordmark } from "@/components/Wordmark";

/**
 * Auth pages: the form on one side, a photograph and a one-line promise on the
 * other. The visual panel drops away below lg so the form gets the full width.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="kun-atmosphere relative grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="kun-grain" aria-hidden />

      <div className="relative z-10 flex min-h-dvh flex-col px-6 py-6 sm:px-12">
        <header className="flex h-10 items-center">
          <Link href="/" aria-label="Kun home">
            <Wordmark />
          </Link>
        </header>
        <main className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          {children}
        </main>
        <footer className="text-[12.5px] text-faint">© 2026 Kun</footer>
      </div>

      <aside className="relative z-10 hidden p-3 lg:block">
        <div className="kun-photo relative h-full min-h-[560px]">
          <Image
            src="/landing/hero-lighthouse.jpg"
            alt="A lighthouse on a dark headland at dusk, one window lit"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 0px"
            className="object-cover object-[72%_50%]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 p-10">
            <p className="max-w-md text-[30px] font-semibold leading-[1.1] tracking-tight text-white">
              A canvas that keeps running.
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75">
              Schedule a workbook, trigger it with a webhook, or call it from an
              agent over MCP. It runs on the server, not in your tab.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
