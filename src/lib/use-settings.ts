"use client";

import { useEffect, useState } from "react";
import { readJson } from "./http";

/**
 * Server-managed provider state. Keys live in the server's .env — there is
 * nothing to enter in the browser, so this hook only reports whether the
 * platform provider is configured (for onboarding badges and the settings
 * dialog).
 */
export function useSettings() {
  const [env, setEnv] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [booted, setBooted] = useState(false);
  const [onboardDismissed, setOnboardDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let cfg: { envProviders?: Record<string, boolean> } = {};
      try {
        cfg = await fetch("/api/config").then((r) =>
          readJson<{ envProviders?: Record<string, boolean> }>(r),
        );
      } catch {
        /* server unreachable — treat as unconfigured */
      }
      if (!alive) return;
      setEnv(cfg.envProviders ?? {});
      setOnboardDismissed(
        window.localStorage.getItem("kun.onboarded") === "1",
      );
      setBooted(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dismissOnboard = () => {
    if (!env.openrouter)
      window.localStorage.setItem("kun.onboarded", "1");
    setOnboardDismissed(true);
    setShowSettings(false);
  };

  const needsOnboard = booted && !env.openrouter && !onboardDismissed;

  return {
    settings: { providers: {} },
    env,
    booted,
    showSettings,
    setShowSettings,
    dismissOnboard,
    needsOnboard,
    /** True when the platform's OpenRouter key is present server-side. */
    configured: !!env.openrouter,
  };
}
