"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJson } from "@/lib/http";
import type { AssetKind, AssetSource } from "@/lib/assets";

export interface Asset {
  id: string;
  kind: AssetKind;
  mimeType: string;
  bytes: number;
  source: AssetSource;
  name: string;
  url: string;
  createdAt: string;
  project: { id: string; title: string } | null;
  credit: { by: string; url: string; page: string } | null;
}

export interface AssetFilters {
  kind: AssetKind | null;
  source: AssetSource | null;
  q: string;
}

/** The workspace's files, newest first, loaded a page at a time. */
export function useAssets(filters: AssetFilters, enabled = true) {
  const [items, setItems] = useState<Asset[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const gen = useRef(0);

  const url = useCallback(
    (before?: string | null) => {
      const sp = new URLSearchParams();
      if (filters.kind) sp.set("kind", filters.kind);
      if (filters.source) sp.set("source", filters.source);
      if (filters.q.trim()) sp.set("q", filters.q.trim());
      if (before) sp.set("before", before);
      return `/api/assets?${sp}`;
    },
    [filters.kind, filters.source, filters.q],
  );

  const reload = useCallback(async () => {
    const mine = ++gen.current;
    try {
      const res = await fetch(url());
      if (!res.ok) throw new Error();
      const j = await readJson<{ assets: Asset[]; next: string | null }>(res);
      if (mine !== gen.current) return;
      setItems(j.assets);
      setNext(j.next);
      setFailed(false);
    } catch {
      if (mine === gen.current) setFailed(true);
    }
  }, [url]);

  useEffect(() => {
    if (!enabled) return;
    // Typing in search should not fire a request per key.
    const t = setTimeout(() => void reload(), filters.q ? 220 : 0);
    return () => clearTimeout(t);
  }, [enabled, reload, filters.q]);

  const more = async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(url(next));
      const j = await readJson<{ assets: Asset[]; next: string | null }>(res);
      setItems((xs) => [...(xs ?? []), ...j.assets]);
      setNext(j.next);
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    items,
    failed,
    hasMore: !!next,
    loadingMore,
    more,
    reload,
    remove: (id: string) => setItems((xs) => (xs ?? []).filter((a) => a.id !== id)),
    rename: (id: string, name: string) =>
      setItems((xs) => (xs ?? []).map((a) => (a.id === id ? { ...a, name } : a))),
  };
}

/** Upload files into the library; resolves to the saved assets' ids. */
export async function uploadAssets(
  files: File[],
  failed: (name: string) => string = (name) => `Couldn’t upload ${name}.`,
): Promise<{ id: string; kind: AssetKind }[]> {
  const out: { id: string; kind: AssetKind }[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await readJson<{ id?: string; error?: string }>(res).catch(
      () => ({} as { id?: string; error?: string }),
    );
    if (!res.ok || !j.id) throw new Error(j.error || failed(file.name));
    out.push({ id: j.id, kind: file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image" });
  }
  return out;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
