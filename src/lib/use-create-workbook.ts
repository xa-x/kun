"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyGraph, starterGraph } from "./starter";
import { readJson } from "./http";
import { toast } from "@/components/Toast";

export type CreateMode = "blank" | "ai";

/** Creates a workbook and opens it. Shared by the sidebar and the library. */
export function useCreateWorkbook() {
  const router = useRouter();
  const [creating, setCreating] = useState<CreateMode | null>(null);

  const create = useCallback(
    async (mode: CreateMode = "blank") => {
      if (creating) return;
      setCreating(mode);
      try {
        const res = await fetch("/api/graphs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: mode === "ai" ? "New flow" : "Untitled",
            graph: mode === "ai" ? emptyGraph() : starterGraph(),
          }),
        });
        const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
        if (!res.ok || !j.graph?.id) throw new Error(j.error || "Create failed");
        router.push(
          mode === "ai" ? `/w/${j.graph.id}?assistant=1` : `/w/${j.graph.id}`,
        );
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Couldn’t create workbook.",
          "error",
        );
        setCreating(null);
      }
    },
    [creating, router],
  );

  return { create, creating };
}
