"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReactFlowProvider } from "@xyflow/react";
import { readJson } from "@/lib/http";
import { StatusScreen } from "./StatusScreen";
import { Canvas } from "./Canvas";
import { useI18n } from "@/lib/i18n";

/** Resolves a share token to its project and renders the viewer. */
export function ShareView({ token }: { token: string }) {
  const { t } = useI18n();
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
        if (!res.ok || !j.graphId) throw new Error(j.error || t("site.share.notFound"));
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
            message: e instanceof Error ? e.message : t("site.share.notFound"),
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, t]);

  if (state.kind === "load") {
    return (
      <StatusScreen
        kicker={t("site.share.kicker")}
        title={t("site.share.loadingTitle")}
        body={t("site.share.loadingBody")}
      />
    );
  }
  if (state.kind === "err") {
    return (
      <StatusScreen
        kicker={t("site.share.kicker")}
        title={t("site.share.errTitle")}
        body={state.message}
        action={
          <Link
            href="/"
            className="kun-btn-primary inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium"
          >
            {t("site.share.goHome")}
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
