"use client";

import { useCallback, useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import { toast } from "@/components/Toast";
import type { ModelPolicyRow } from "@/lib/model-policy";

/**
 * Admin control page — model enablement, price overrides, and margins,
 * backed by /api/admin/models. Models without a policy row are enabled at
 * provider-reported cost; rows exist to disable or reprice.
 */
export default function AdminModelsPage() {
  const [rows, setRows] = useState<ModelPolicyRow[] | null>(null);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/models")
      .then((r) => readJson<{ policies?: ModelPolicyRow[] }>(r))
      .then((j) => setRows(j.policies ?? []))
      .catch(() => setRows([]));
  }, []);

  useEffect(load, [load]);

  const save = async (patch: {
    model: string;
    enabled?: boolean;
    pricePerUsd?: number | null;
    marginPct?: number;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Save failed");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const model = adding.trim();
    if (!model) return;
    await save({ model, enabled: true });
    setAdding("");
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 md:px-10 md:py-12">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
        Models
      </h1>
      <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
        Enablement, price overrides, and margins for every model on this
        instance. Models without a policy are enabled at provider-reported
        cost; billed cost = override (or provider cost) × (1 + margin).
      </p>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="openai/gpt-5.2"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 font-mono text-[12.5px] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !adding.trim()}
          className="kun-btn-primary rounded-full px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
        >
          Add policy
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line">
        {rows === null ? (
          <div className="h-32 animate-pulse bg-card/60" />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            No model policies — every model is enabled at provider cost.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <PolicyRow key={row.model} row={row} busy={busy} onSave={save} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PolicyRow({
  row,
  busy,
  onSave,
}: {
  row: ModelPolicyRow;
  busy: boolean;
  onSave: (patch: {
    model: string;
    enabled?: boolean;
    pricePerUsd?: number | null;
    marginPct?: number;
  }) => Promise<void>;
}) {
  const [price, setPrice] = useState(row.pricePerUsd == null ? "" : String(row.pricePerUsd));
  const [margin, setMargin] = useState(String(row.marginPct));

  const save = () => {
    const parsedPrice = price.trim() === "" ? null : Number(price);
    const parsedMargin = Number(margin);
    void onSave({
      model: row.model,
      enabled: row.enabled,
      pricePerUsd: parsedPrice != null && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
      marginPct:
        Number.isFinite(parsedMargin) && parsedMargin >= 0 && parsedMargin <= 1000
          ? Math.round(parsedMargin)
          : row.marginPct,
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 bg-card/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12.5px] text-ink">{row.model}</p>
        <p className="mt-0.5 text-[11px] text-faint">
          {row.enabled ? "Enabled" : "Disabled"} ·{" "}
          {row.pricePerUsd == null ? "provider cost" : `$${row.pricePerUsd} override`} ·{" "}
          {row.marginPct}% margin
        </p>
      </div>
      <button
        onClick={() => void onSave({ model: row.model, enabled: !row.enabled })}
        disabled={busy}
        className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors disabled:opacity-50 ${
          row.enabled
            ? "bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
            : "bg-ink/[0.06] text-faint hover:text-ink"
        }`}
      >
        {row.enabled ? "Enabled" : "Disabled"}
      </button>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="price $"
        inputMode="decimal"
        className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-right font-mono text-[12px] text-ink outline-none placeholder:text-faint"
      />
      <input
        value={margin}
        onChange={(e) => setMargin(e.target.value)}
        placeholder="margin %"
        inputMode="decimal"
        className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-right font-mono text-[12px] text-ink outline-none placeholder:text-faint"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-full border border-line px-3 py-1 text-[11.5px] text-muted transition-colors hover:text-ink disabled:opacity-50"
      >
        Save
      </button>
    </li>
  );
}
