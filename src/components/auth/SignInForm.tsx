"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Warning } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { resetSessionInfo } from "@/lib/session-info";
import { SIGN_UP } from "@/lib/routes";
import { SIGNUP_OPEN } from "@/lib/signup-mode";
import { AuthField } from "./AuthField";

export function SignInForm({
  next,
  configured,
}: {
  /** Already validated server-side by safeNext(). */
  next: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Sign in failed");
      resetSessionInfo();
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
        Sign in to pick up your workbooks where you left them.
      </p>

      {!configured && process.env.NODE_ENV !== "production" && (
        <div
          role="note"
          className="mt-6 flex gap-3 rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-[13px] leading-snug text-ink"
        >
          <Warning size={18} weight="bold" className="mt-px shrink-0 text-warn" aria-hidden />
          <p>
            Auth isn&apos;t configured for this server. Set{" "}
            <code className="font-mono text-[12px]">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and{" "}
            <code className="font-mono text-[12px]">
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </code>{" "}
            in <code className="font-mono text-[12px]">.env.local</code>.
          </p>
        </div>
      )}

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <AuthField
          label="Email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <p
          role="alert"
          aria-live="assertive"
          className={`text-[13px] text-err ${error ? "" : "hidden"}`}
        >
          {error}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="kun-btn-primary flex h-11 w-full items-center justify-center rounded-full text-[14px] font-medium disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        {SIGNUP_OPEN ? (
          <>
            New to Kun?{" "}
            <Link
              href={SIGN_UP}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          "New accounts are invite-only while we build."
        )}
      </p>
    </div>
  );
}
