"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyGraph, starterGraph } from "./starter";
import { readJson } from "./http";
import { toast } from "@/components/Toast";
import { useI18n } from "./i18n";

/** A short project title from what the user asked for. */
function titleFrom(prompt?: string) {
  const t = prompt?.trim().replace(/\s+/g, " ");
  if (!t) return "New flow";
  const first = t.split(/[.\n]/)[0];
  return first.length > 48 ? `${first.slice(0, 45).trimEnd()}…` : first;
}

export type CreateMode = "blank" | "ai";

/** Creates a project and opens it. Shared by the sidebar and the library. */
export function useCreateWorkbook() {
  const router = useRouter();
  const { t } = useI18n();
  const [creating, setCreating] = useState<CreateMode | null>(null);

  const create = useCallback(
    async (mode: CreateMode = "blank", prompt?: string) => {
      if (creating) return;
      setCreating(mode);
      try {
        const res = await fetch("/api/graphs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: mode === "ai" ? titleFrom(prompt) : "Untitled",
            graph: mode === "ai" ? emptyGraph() : starterGraph(),
          }),
        });
        const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
        if (!res.ok || !j.graph?.id) throw new Error(j.error || t("shell.create.failed"));
        const ask = prompt?.trim().slice(0, 600);
        router.push(
          mode === "ai"
            ? `/w/${j.graph.id}?assistant=1${ask ? `&prompt=${encodeURIComponent(ask)}` : ""}`
            : `/w/${j.graph.id}`,
        );
      } catch (e) {
        toast(
          e instanceof Error ? e.message : t("shell.create.failed"),
          "error",
        );
        setCreating(null);
      }
    },
    [creating, router, t],
  );

  return { create, creating };
}
