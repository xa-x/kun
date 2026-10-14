"use client";

import { useCallback, useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/Toast";
import type { ModelPolicyRow } from "@/lib/model-policy";

/**
 * Admin control page — model enablement, price overrides, and margins,
 * backed by /api/admin/models. Models without a policy row are enabled at
 * provider-reported cost; rows exist to disable or reprice.
 */
export default function AdminModelsPage() {
  const { t } = useI18n();
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
    pinRank?: number | null;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || t("settings.admin.models.saveFailed"));
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.admin.models.saveFailed"), "error");
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
        {t("settings.admin.models.title")}
      </h1>
      <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
        {t("settings.admin.models.desc")}
      </p>

      <SpendCheck onPick={setAdding} />

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
          dir="ltr"
          className="flex-1 rounded-lg border border-line bg-card px-3 py-2 font-mono text-[12.5px] text-ink outline-none placeholder:text-faint"
        />
        <button
          type="submit"
          disabled={busy || !adding.trim()}
          className="kun-btn-primary rounded-full px-4 py-2 text-[12.5px] font-medium disabled:opacity-50"
        >
          {t("settings.admin.models.add")}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line">
        {rows === null ? (
          <div className="h-32 animate-pulse bg-card/60" />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-muted">
            {t("settings.admin.models.empty")}
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

interface Spend {
  providerUsd: number | null;
  ledgerUsd: number;
  gapUsd: number | null;
  unpriced: { model: string; calls: number }[];
}

/**
 * Does the ledger match what OpenRouter charged? Image generation reports no
 * cost, so it can run, cost money, and be recorded as free. Models listed
 * here finished only at $0: set a price on each to start billing them.
 */
function SpendCheck({ onPick }: { onPick: (model: string) => void }) {
  const { t } = useI18n();
  const [spend, setSpend] = useState<Spend | null | "error">(null);
  useEffect(() => {
    fetch("/api/admin/spend")
      .then((r) => readJson<Spend>(r))
      .then(setSpend)
      .catch(() => setSpend("error"));
  }, []);
  if (spend === null) return <div className="mt-8 h-24 animate-pulse rounded-2xl bg-card/60" />;
  if (spend === "error" || !("ledgerUsd" in spend)) return null;

  const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
  const gap = spend.gapUsd ?? 0;
  const ok = spend.gapUsd != null && gap < 0.01 && !spend.unpriced.length;
  return (
    <section
      aria-label={t("settings.admin.spend.title")}
      className={`mt-8 rounded-2xl border p-5 ${ok ? "border-line" : "border-warn/50 bg-warn/5"}`}
    >
      <p className="text-[13px] font-medium text-ink">{t("settings.admin.spend.title")}</p>
      <dl className="mt-3 grid grid-cols-3 gap-4 font-mono text-[13px]">
        <div>
          <dt className="text-[11px] text-faint">{t("settings.admin.spend.charged")}</dt>
          <dd className="mt-0.5 text-ink">
            {spend.providerUsd == null ? "—" : usd(spend.providerUsd)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-faint">{t("settings.admin.spend.recorded")}</dt>
          <dd className="mt-0.5 text-ink">{usd(spend.ledgerUsd)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-faint">{t("settings.admin.spend.notRecorded")}</dt>
          <dd className={`mt-0.5 ${gap >= 0.01 ? "text-warn" : "text-ink"}`}>
            {spend.gapUsd == null ? "—" : usd(gap)}
          </dd>
        </div>
      </dl>
      {spend.unpriced.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[12.5px] text-muted">
            {t("settings.admin.spend.unpriced")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {spend.unpriced.map((u) => (
              <li key={u.model}>
                <button
                  type="button"
                  onClick={() => onPick(u.model)}
                  className="rounded-full border border-line px-3 py-1 font-mono text-[11.5px] text-ink transition-colors hover:border-line2"
                >
                  <bdi dir="ltr">{u.model}</bdi> × {u.calls}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
    pinRank?: number | null;
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [price, setPrice] = useState(row.pricePerUsd == null ? "" : String(row.pricePerUsd));
  const [margin, setMargin] = useState(String(row.marginPct));
  const [pin, setPin] = useState(row.pinRank == null ? "" : String(row.pinRank));

  const save = () => {
    const parsedPrice = price.trim() === "" ? null : Number(price);
    const parsedMargin = Number(margin);
    const parsedPin = pin.trim() === "" ? null : Number(pin);
    void onSave({
      model: row.model,
      enabled: row.enabled,
      pricePerUsd: parsedPrice != null && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
      marginPct:
        Number.isFinite(parsedMargin) && parsedMargin >= 0 && parsedMargin <= 1000
          ? Math.round(parsedMargin)
          : row.marginPct,
      pinRank:
        parsedPin != null && Number.isInteger(parsedPin) && parsedPin >= 0 && parsedPin <= 999
          ? parsedPin
          : null,
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 bg-card/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[12.5px] text-ink" dir="ltr">{row.model}</p>
        <p className="mt-0.5 text-[11px] text-faint">
          {row.enabled ? t("settings.admin.models.enabled") : t("settings.admin.models.disabled")} ·{" "}
          {row.pricePerUsd == null
            ? t("settings.admin.models.providerCost")
            : t("settings.admin.models.override", { price: `$${row.pricePerUsd}` })}{" "}
          · {t("settings.admin.models.margin", { pct: row.marginPct })} ·{" "}
          {row.pinRank == null ? t("settings.admin.models.notPinned") : t("settings.admin.models.pinned", { rank: row.pinRank })}
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
        {row.enabled ? t("settings.admin.models.enabled") : t("settings.admin.models.disabled")}
      </button>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder={t("settings.admin.models.price")}
        inputMode="decimal"
        className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-end font-mono text-[12px] text-ink outline-none placeholder:text-faint"
      />
      <input
        value={margin}
        onChange={(e) => setMargin(e.target.value)}
        placeholder={t("settings.admin.models.marginPh")}
        inputMode="decimal"
        className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-end font-mono text-[12px] text-ink outline-none placeholder:text-faint"
      />
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder={t("settings.admin.models.pinPh")}
        inputMode="numeric"
        title={t("settings.admin.models.pinTitle")}
        className="w-16 rounded-lg border border-line bg-card px-2 py-1 text-end font-mono text-[12px] text-ink outline-none placeholder:text-faint"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-full border border-line px-3 py-1 text-[11.5px] text-muted transition-colors hover:text-ink disabled:opacity-50"
      >
        {t("common.save")}
      </button>
    </li>
  );
}
