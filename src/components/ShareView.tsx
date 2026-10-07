"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import { readJson } from "@/lib/http";
import { StatusScreen } from "./StatusScreen";
import { Canvas } from "./Canvas";

/** Resolves a share token to its workbook and renders the viewer. */
export function ShareView({ token }: { token: string }) {
  const [state, setState] = useState<
    | { kind: "load" }
    | { kind: "err"; message: string }
    | { kind: "ok"; graphId: string; permission: string }
  >({ kind: "load" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/shares/${token}`);
        const j = await readJson<{ graphId?: string; permission?: string; error?: string }>(res);
        if (!res.ok || !j.graphId) throw new Error(j.error || "Share not found");
        if (alive)
          setState({
            kind: "ok",
            graphId: j.graphId,
            permission: j.permission || "view",
          });
      } catch (e) {
        if (alive)
          setState({
            kind: "err",
            message: e instanceof Error ? e.message : "Share not found",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (state.kind === "load") {
    return (
      <StatusScreen
        kicker="Shared workbook"
        title="Opening workbook…"
        body="Loading a read-only copy."
      />
    );
  }
  if (state.kind === "err") {
    return (
      <StatusScreen
        kicker="Shared workbook"
        title="This link isn’t available"
        body={state.message}
        action={
          <Link
            href="/"
            className="kun-btn-primary inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium"
          >
            Go to Kun
          </Link>
        }
      />
    );
  }

  return (
    <ReactFlowProvider>
      <Canvas
        key={state.graphId}
        graphId={state.graphId}
        shareToken={token}
        readOnly={state.permission === "view"}
      />
    </ReactFlowProvider>
  );
}
