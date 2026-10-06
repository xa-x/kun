"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ModelInfo } from "./models";
import { mergeRefresh } from "./models";
import { readJson } from "./http";

/**
 * Live model catalogs per provider, fetched through /api/models (which
 * queries each provider's standard `/models` endpoint) and cached in
 * localStorage so dropdowns paint instantly.
 */

export interface ModelCatalog {
  models: Record<string, ModelInfo[]>;
  updatedAt: number;
  /** Providers whose last fetch failed — their lists may be stale. */
  errors?: Record<string, string>;
}

const EMPTY: ModelCatalog = { models: {}, updatedAt: 0 };
const CACHE_KEY = "kun.catalog.v6";
/** Re-fetch when the tab regains focus, at most this often. */
const FOCUS_REFETCH_MS = 15 * 60_000;

function readCache(): ModelCatalog | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelCatalog;
    if (parsed.models && typeof parsed.models === "object")
      return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(c: ModelCatalog) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* private mode */
  }
}

const Ctx = createContext<ModelCatalog>(EMPTY);

export function useModelCatalog(
  env: Record<string, boolean>,
): { catalog: ModelCatalog; reload: () => void } {
  const [catalog, setCatalog] = useState<ModelCatalog>(() => {
    if (typeof window === "undefined") return EMPTY;
    return readCache() ?? EMPTY;
  });

  // signature: env flag flips (e.g. operator adds the key) trigger a refetch
  const sig = env.openrouter ? "openrouter:1" : "openrouter:0";
  const lastSig = useRef<string>("");

  // Concurrent refreshes are allowed; a slower response can never clobber a
  // fresher one (mergeRefresh checks updatedAt) or a provider it failed to
  // reach — its last good list is kept instead.
  const reload = useCallback(() => {
    fetch("/api/models", { method: "POST" })
      .then((r) =>
        readJson<{
          models?: Record<string, ModelInfo[]>;
          errors?: Record<string, string>;
        }>(r),
      )
      .then((data) => {
        const incoming: ModelCatalog = {
          models:
            data?.models && typeof data.models === "object" ? data.models : {},
          updatedAt: Date.now(),
          errors:
            data?.errors && typeof data.errors === "object"
              ? (data.errors as Record<string, string>)
              : undefined,
        };
        setCatalog((prev) => {
          const next = mergeRefresh(prev, incoming);
          try {
            const cur = readCache();
            if (!cur || next.updatedAt >= cur.updatedAt) writeCache(next);
          } catch {
            /* ignore */
          }
          return next;
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (lastSig.current === sig) return;
    lastSig.current = sig;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // The signature effect only fires on mount and settings changes; without
  // this, a tab left open would keep offering retired models forever.
  // `reload` changes identity only with the settings signature, so the
  // listeners re-subscribe about as often as the catalog re-fetches anyway.
  useEffect(() => {
    let lastFocus = 0;
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastFocus < FOCUS_REFETCH_MS) return;
      lastFocus = now;
      reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [reload]);

  return { catalog, reload };
}

export function ModelCatalogProvider({
  value,
  children,
}: {
  value: ModelCatalog;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);
