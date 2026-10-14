"use client";

import { useId, useState } from "react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { toast } from "./Toast";
import { Modal } from "./ui/Modal";

export function PublishTemplate({
  graphId,
  title,
  onClose,
}: {
  graphId: string;
  title: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ids = { name: useId(), desc: useId(), tags: useId() };
  const [name, setName] = useState(title);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [includeMedia, setIncludeMedia] = useState(true);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          graphId,
          title: name,
          description,
          tags: tags.split(/[,،]/).map((t) => t.trim()).filter(Boolean),
          includeMedia,
        }),
      });
      const j = await readJson<{
        template?: { slug: string };
        error?: string;
      }>(res);
      if (!res.ok || !j.template) throw new Error(j.error || t("editor.publish.failed"));
      const url = `${window.location.origin}/templates/${j.template.slug}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast(t("editor.publish.done"), "ok");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.publish.failed"), "error");
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-[13px] font-medium text-ink";

  return (
    <Modal
      title={t("editor.publish.title")}
      description={t("editor.publish.description")}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full px-5 text-[13.5px] text-muted transition-colors hover:text-ink"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || !name.trim()}
            className="kun-btn-primary h-10 rounded-full px-6 text-[13.5px] font-medium disabled:opacity-60"
          >
            {busy ? t("editor.publish.publishing") : t("common.publish")}
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
      >
        <div>
          <label htmlFor={ids.name} className={label}>
            {t("editor.publish.name")}
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="auto"
            className="kun-input"
          />
        </div>
        <div>
          <label htmlFor={ids.desc} className={label}>
            {t("editor.publish.about")}
          </label>
          <textarea
            id={ids.desc}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            dir="auto"
            className="kun-input resize-y"
          />
        </div>
        <div>
          <label htmlFor={ids.tags} className={label}>
            {t("editor.publish.tags")}
          </label>
          <input
            id={ids.tags}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t("editor.publish.tagsPlaceholder")}
            dir="auto"
            className="kun-input"
          />
          <p className="mt-1.5 text-[12.5px] text-faint">{t("editor.publish.tagsHint")}</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3.5">
          <input
            type="checkbox"
            checked={includeMedia}
            onChange={(e) => setIncludeMedia(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--ink,#fff)]"
          />
          <span>
            <span className="block text-[13px] font-medium text-ink">{t("editor.publish.includeMedia")}</span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
              {t("editor.publish.includeMediaHint")}
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
