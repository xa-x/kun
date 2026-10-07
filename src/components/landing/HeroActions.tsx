"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { fetchSessionInfo } from "@/lib/session-info";
import { APP_HOME, SIGN_IN, SIGN_UP } from "@/lib/routes";
import { SIGNUP_OPEN } from "@/lib/signup-mode";

/**
 * Primary and secondary calls to action. The landing page is static, so this
 * island asks the session endpoint and swaps "Sign in" for "Open workbooks".
 * One label per intent across the whole page: sign in / open / browse.
 */
export function HeroActions({
  tone = "default",
}: {
  tone?: "default" | "onImage";
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchSessionInfo().then((s) => alive && setSignedIn(!!s.user));
    return () => {
      alive = false;
    };
  }, []);

  const primary = signedIn
    ? { href: APP_HOME, label: "Open workbooks" }
    : SIGNUP_OPEN
      ? { href: SIGN_UP, label: "Start free" }
      : { href: SIGN_IN, label: "Sign in" };

  const secondary =
    tone === "onImage"
      ? "border border-white/35 bg-white/10 text-white hover:bg-white/20"
      : "kun-btn-secondary";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={primary.href}
        className="kun-btn-primary group inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-medium"
      >
        {primary.label}
        <ArrowRight
          size={15}
          weight="bold"
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
      <Link
        href="/templates"
        className={`inline-flex h-12 items-center rounded-full px-7 text-[15px] font-medium transition-colors ${secondary}`}
      >
        Browse templates
      </Link>
    </div>
  );
}
