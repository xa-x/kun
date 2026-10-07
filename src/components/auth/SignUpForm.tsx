"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockSimple } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { resetSessionInfo } from "@/lib/session-info";
import { toast } from "@/components/Toast";
import { APP_HOME, SIGN_IN } from "@/lib/routes";
import { SIGNUP_OPEN } from "@/lib/signup-mode";
import { AuthField } from "./AuthField";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const j = await readJson<{
        error?: string;
        needsConfirmation?: boolean;
        message?: string;
      }>(res);
      if (res.status === 202 && j.needsConfirmation) {
        toast(
          j.message || "Check your email to confirm your account, then sign in.",
          "info",
        );
        router.replace(SIGN_IN);
        return;
      }
      if (!res.ok) throw new Error(j.error || "Sign up failed");
      resetSessionInfo();
      router.replace(APP_HOME);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
      setBusy(false);
    }
  };

  if (!SIGNUP_OPEN) {
    return (
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
          Kun is invite-only
        </h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
          We&apos;re still building, so accounts are created by invitation.
        </p>
        <div className="mt-8 flex gap-3.5 rounded-2xl border border-line bg-card/60 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/8 text-ink">
            <LockSimple size={16} weight="bold" aria-hidden />
          </span>
          <p className="text-[13.5px] leading-relaxed text-muted">
            Ask whoever runs this instance for an invite. If you already have an
            account, sign in to continue.
          </p>
        </div>
        <Link
          href={SIGN_IN}
          className="kun-btn-primary mt-6 flex h-11 w-full items-center justify-center rounded-full text-[14px] font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
        A private workspace for your pipelines. Drawing nodes is free.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <AuthField
          label="Name"
          required
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <AuthField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="-mt-2 text-[12.5px] text-faint">At least 6 characters.</p>

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
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-muted">
        Already have an account?{" "}
        <Link
          href={SIGN_IN}
          className="font-medium text-ink underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
