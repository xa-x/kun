"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readJson } from "@/lib/http";
import { toast } from "@/components/Toast";
import { SIGNUP_OPEN } from "@/lib/signup-mode";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const j = await readJson<{ error?: string; needsConfirmation?: boolean; message?: string }>(
        res,
      );
      if (res.status === 202 && j.needsConfirmation) {
        toast(j.message || "Check your email to confirm your account, then sign in.", "info");
        router.push("/sign-in");
        return;
      }
      if (!res.ok) throw new Error(j.error || "Sign up failed");
      router.push("/");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Sign up failed", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!SIGNUP_OPEN) {
    return (
      <div>
        <h1 className="text-[24px] font-semibold text-ink">Create account</h1>
        <p className="mt-1 text-[13px] text-muted">كُن is still under development.</p>
        <div className="mt-6 rounded-2xl border border-line bg-card/60 px-5 py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
            Invite only
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            We&apos;re not accepting public sign-ups yet. Accounts are created by
            invitation — ask the instance operator, or sign in if you already
            have one.
          </p>
        </div>
        <fieldset disabled className="mt-6" aria-hidden>
          <label className="block opacity-50">
            <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-faint">
              Email
            </span>
            <input
              tabIndex={-1}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none"
            />
          </label>
          <label className="mt-3 block opacity-50">
            <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-faint">
              Password
            </span>
            <input
              type="password"
              tabIndex={-1}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none"
            />
          </label>
        </fieldset>
        <button
          disabled
          className="mt-5 w-full cursor-not-allowed rounded-full border border-line py-2 text-[13px] font-medium text-faint"
        >
          Invite required
        </button>
        <Link
          href="/sign-in"
          className="mt-3 block text-center text-[12px] text-muted transition-colors hover:text-ink"
        >
          Already have an account? Sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[24px] font-semibold text-ink">Create account</h1>
      <p className="mt-1 text-[13px] text-muted">A workspace for your pipelines.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="mt-6 block">
          <span className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-faint">
            Name
          </span>
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink outline-none"
          />
        </label>
        <label className="mt-3 block">
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
            minLength={6}
            autoComplete="new-password"
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
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <Link
        href="/sign-in"
        className="mt-3 block text-center text-[12px] text-muted transition-colors hover:text-ink"
      >
        Already have an account? Sign in
      </Link>
    </div>
  );
}
