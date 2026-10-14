"use client";

import { useCallback, useEffect, useState } from "react";
import { readJson } from "@/lib/http";

/** Fetch an admin endpoint; `reload` refetches after a change. */
export function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const res = await fetch(url);
      const j = await readJson<T & { error?: string }>(res);
      if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  }, [url]);
  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);
  return { data, error, reload };
}
