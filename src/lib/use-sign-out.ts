"use client";

import { useCallback, useState } from "react";
import { resetSessionInfo } from "./session-info";
import { HOME } from "./routes";

/**
 * Ends the Supabase session, then does a full navigation to the landing page
 * so every client-side cache (router, session, model catalog) starts clean.
 */
export function useSignOut() {
  const [busy, setBusy] = useState(false);
  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      resetSessionInfo();
      window.location.assign(HOME);
    }
  }, []);
  return { signOut, busy };
}
