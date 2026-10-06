import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

/** Centered card layout for /sign-in and /sign-up — no app chrome. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="kun-atmosphere relative flex min-h-dvh flex-col">
      <div className="kun-grain" aria-hidden />
      <header className="relative z-10 flex h-14 shrink-0 items-center border-b border-line/80 px-5">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16">
        {children}
      </main>
    </div>
  );
}
