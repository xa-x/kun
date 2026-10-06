"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readJson } from "@/lib/http";
import { toast } from "@/components/Toast";
import { SIGNUP_OPEN } from "@/lib/signup-mode";

/** Only in-app destinations via ?next= — never protocol-relative or absolute. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Sign in failed");
      router.push(safeNext(new URLSearchParams(window.location.search).get("next")));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign in failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-[24px] font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-[13px] text-muted">Welcome back — your workbooks are waiting.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="mt-6 block">
          <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-faint">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-faint">
            Password
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="kun-btn-primary mt-5 w-full rounded-full py-2 text-[13px] font-medium disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {SIGNUP_OPEN ? (
        <Link
          href="/sign-up"
          className="mt-3 block text-center text-[12px] text-muted transition-colors hover:text-ink"
        >
          Need an account? Create one
        </Link>
      ) : (
        <p className="mt-3 text-center text-[12px] text-faint">
          New accounts are invite-only while we build.
        </p>
      )}
    </div>
  );
}
