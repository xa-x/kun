"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { THEME_KEY, resolveTheme, type ThemePref } from "@/lib/theme";

const PREF_EVENT = "kun:theme-pref";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const Ctx = createContext<{
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
}>({
  pref: "system",
  resolved: "dark",
  setPref: () => {},
});

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(PREF_EVENT, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREF_EVENT, onChange);
  };
}

function readPref(): ThemePref {
  const saved = window.localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" || saved === "system"
    ? saved
    : "system";
}

/**
 * Theme state backed by external stores (localStorage and the OS setting).
 * The server snapshot is fixed, so hydration always matches the server HTML;
 * the real values are applied by the immediate post-hydration re-render. The
 * boot script in the root layout has already painted the right colours.
 */
export function ThemeProvider({
  children,
  initial = "system",
}: {
  children: React.ReactNode;
  initial?: ThemePref;
}) {
  const pref = useSyncExternalStore(subscribe, readPref, () => initial);
  const systemDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DARK_QUERY).matches,
    () => true,
  );

  const resolved = useMemo(() => resolveTheme(pref, systemDark), [pref, systemDark]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo(
    () => ({
      pref,
      resolved,
      setPref: (p: ThemePref) => {
        window.localStorage.setItem(THEME_KEY, p);
        window.dispatchEvent(new Event(PREF_EVENT));
        void fetch("/api/theme", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ theme: p }),
        }).catch(() => {});
      },
    }),
    [pref, resolved],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
