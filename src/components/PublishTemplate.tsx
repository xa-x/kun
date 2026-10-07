"use client";

import { useId, useState } from "react";
import { readJson } from "@/lib/http";
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
  const ids = { name: useId(), desc: useId(), tags: useId() };
  const [name, setName] = useState(title);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
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
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const j = await readJson<{
        template?: { slug: string };
        error?: string;
      }>(res);
      if (!res.ok || !j.template) throw new Error(j.error || "Publish failed");
      const url = `${window.location.origin}/templates/${j.template.slug}`;
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast("Published to the template gallery. Link copied.", "ok");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Publish failed", "error");
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-[13px] font-medium text-ink";

  return (
    <Modal
      title="Publish workbook"
      description="Anyone on this deployment can browse and clone it. Uploaded media is stripped; skills travel with the snapshot."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full px-5 text-[13.5px] text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy || !name.trim()}
            className="kun-btn-primary h-10 rounded-full px-6 text-[13.5px] font-medium disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish"}
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
            Title
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="kun-input"
          />
        </div>
        <div>
          <label htmlFor={ids.desc} className={label}>
            Description
          </label>
          <textarea
            id={ids.desc}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="kun-input resize-y"
          />
        </div>
        <div>
          <label htmlFor={ids.tags} className={label}>
            Tags
          </label>
          <input
            id={ids.tags}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="image, product, starter"
            className="kun-input"
          />
          <p className="mt-1.5 text-[12.5px] text-faint">Separate with commas.</p>
        </div>
      </form>
    </Modal>
  );
}
