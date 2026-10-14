"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DownloadSimple, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { kindLabel } from "./kind";
import { fmtBytes, type Asset } from "./use-assets";

const SOURCE: Record<Asset["source"], MessageKey> = {
  upload: "shell.assets.source.upload",
  generated: "shell.assets.source.generated",
  stock: "shell.assets.source.stock",
};

/** One file, large, with what you can do to it. */
export function AssetPreview({
  asset,
  onClose,
  onRenamed,
  onDeleted,
}: {
  asset: Asset;
  onClose: () => void;
  onRenamed: (id: string, name: string) => void;
  onDeleted: (id: string) => void;
}) {
  const { t, ago } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asset.name);
  const [usedIn, setUsedIn] = useState<{ id: string; title: string }[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startDelete = async () => {
    setConfirm(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`);
      const j = await readJson<{ usedIn: { id: string; title: string }[] }>(res);
      setUsedIn(j.usedIn);
    } catch {
      setUsedIn([]);
    }
  };

  const rename = async () => {
    setEditing(false);
    const name = draft.trim().slice(0, 120);
    if (!name || name === asset.name) return setDraft(asset.name);
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) onRenamed(asset.id, name);
    else toast(t("shell.assets.renameFailed"), "error");
  };

  const remove = async () => {
    setBusy(true);
    const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast(t("shell.assets.deleteFailed"), "error");
    toast(t("shell.assets.deleted"), "ok");
    onDeleted(asset.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label={t("shell.assets.closePreview")} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside
        role="dialog"
        aria-label={asset.name}
        className="kun-pop relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-s border-line bg-card md:max-w-[520px]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <p className="text-[12px] uppercase tracking-[0.12em] text-faint">{kindLabel(t, asset.kind)}</p>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-8 w-8 items-center justify-center rounded-full text-faint hover:bg-ink/8 hover:text-ink">
            <X size={14} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="mx-5 flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-sunken">
          {asset.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.name} className="max-h-[52vh] w-full object-contain" />
          )}
          {asset.kind === "video" && <video src={asset.url} controls playsInline className="max-h-[52vh] w-full" />}
          {asset.kind === "audio" && <audio src={asset.url} controls className="w-full px-4 py-10" />}
        </div>

        <div className="space-y-5 px-5 py-5">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void rename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void rename();
                if (e.key === "Escape") {
                  setDraft(asset.name);
                  setEditing(false);
                }
              }}
              aria-label={t("shell.assets.fileName")}
              dir="auto"
              className="kun-input text-[16px] font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(asset.name);
                setEditing(true);
              }}
              className="group flex w-full items-center gap-2 text-start"
              aria-label={t("shell.assets.renameFile")}
            >
              <span dir="auto" className="min-w-0 flex-1 truncate text-[16px] font-medium text-ink">{asset.name}</span>
              <PencilSimple size={14} className="text-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </button>
          )}

          <dl className="grid grid-cols-[88px_1fr] gap-y-2 text-[13px]">
            <dt className="text-faint">{t("shell.assets.source")}</dt>
            <dd className="text-ink">{t(SOURCE[asset.source])}</dd>
            <dt className="text-faint">{t("shell.assets.added")}</dt>
            <dd className="text-ink">{ago(asset.createdAt)}</dd>
            <dt className="text-faint">{t("shell.assets.size")}</dt>
            <dd dir="ltr" className="text-start font-mono text-[12.5px] text-ink">{fmtBytes(asset.bytes)}</dd>
            {asset.project && (
              <>
                <dt className="text-faint">{t("shell.assets.madeIn")}</dt>
                <dd>
                  <Link href={`/w/${asset.project.id}`} dir="auto" className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                    {asset.project.title}
                  </Link>
                </dd>
              </>
            )}
            {asset.credit && (
              <>
                <dt className="text-faint">{t("shell.assets.photoBy")}</dt>
                <dd>
                  <a href={asset.credit.url} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                    {asset.credit.by}
                  </a>{" "}
                  <span className="text-faint">{t("shell.assets.on")}</span>{" "}
                  <a href={asset.credit.page} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                    Unsplash
                  </a>
                </dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2">
            <a
              href={`${asset.url}?download`}
              className="kun-btn-secondary inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium"
            >
              <DownloadSimple size={15} aria-hidden />
              {t("common.download")}
            </a>
            {!confirm && (
              <button
                type="button"
                onClick={() => void startDelete()}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] text-muted transition-colors hover:bg-err/10 hover:text-err"
              >
                <Trash size={15} aria-hidden />
                {t("common.delete")}
              </button>
            )}
          </div>

          {confirm && (
            <div role="alert" className="rounded-xl border border-err/30 bg-err/5 p-3.5">
              <p className="text-[13px] text-ink">
                {usedIn === null
                  ? t("shell.assets.checking")
                  : usedIn.length
                    ? t("shell.assets.usedIn", {
                        list: usedIn.map((p) => `“${p.title || t("common.untitled")}”`).join(t("shell.assets.listSep")),
                      })
                    : t("shell.assets.notUsed")}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy || usedIn === null} onClick={() => void remove()} className="h-9 rounded-full bg-err px-4 text-[12.5px] font-medium text-white disabled:opacity-50">
                  {busy ? t("common.deleting") : t("shell.assets.deleteFile")}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-full px-4 text-[12.5px] text-muted hover:text-ink">
                  {t("shell.assets.keep")}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
