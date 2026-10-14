"use client";

import { CaretDown, Sparkle } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { parseSkillMd } from "@/lib/skills/format";
import { toast } from "./Toast";

export interface SkillChoice {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  source?: string;
  registryId?: string | null;
  brief?: string;
  instructions?: string;
  body?: string;
  resolvable?: boolean;
  installs?: number;
  skillId?: string;
  name?: string;
}

function sourceLabel(t: (k: "editor.skill.bundled" | "editor.skill.installed" | "editor.skill.yours") => string, source?: string) {
  if (source === "builtin") return t("editor.skill.bundled");
  if (source === "registry") return t("editor.skill.installed");
  if (source === "local") return t("editor.skill.yours");
  return "skills.sh";
}

function byName(a: SkillChoice, b: SkillChoice) {
  return a.displayName.localeCompare(b.displayName);
}

function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Mode = "list" | "create" | "import";

export function SkillPicker({
  value,
  onPick,
  compact,
  draft,
}: {
  value?: string;
  onPick: (skill: SkillChoice | null) => void;
  compact?: boolean;
  /** Prefill "New skill" from the current node text. */
  draft?: { displayName?: string; body?: string };
}) {
  const { t, tn } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [pulling, setPulling] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const [installed, setInstalled] = useState<SkillChoice[]>([]);
  const [remote, setRemote] = useState<SkillChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const startCreate = () => {
    setMode("create");
    setOpen(true);
    setName(draft?.displayName && draft.displayName !== "Skill" ? draft.displayName : "");
    setDescription("");
    setBody(draft?.body ?? "");
    setBrief("");
  };

  const startImport = () => {
    setMode("import");
    setOpen(true);
    setRefInput("");
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/skills")
      .then((r) => readJson<{ skills?: SkillChoice[] }>(r))
      .then((j) => {
        if (alive) setInstalled(j.skills ?? []);
      })
      .catch(() => {
        if (alive) setInstalled([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!open || q.trim().length < 2) {
        setRemote([]);
        return;
      }
      setLoading(true);
      fetch(`/api/skills/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => readJson<{ skills?: SkillChoice[] }>(r))
        .then((j) =>
          setRemote(
            (j.skills ?? []).map((s) => ({
              ...s,
              slug: s.skillId || s.slug,
              displayName: s.name || s.displayName || s.skillId || s.slug,
              description: s.description ?? "",
            })),
          ),
        )
        .catch(() => setRemote([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [open, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = useMemo(
    () =>
      installed.find((s) => s.slug === value || s.id === value) ?? null,
    [installed, value],
  );

  const localHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return installed;
    return installed.filter(
      (s) =>
        s.displayName.toLowerCase().includes(needle) ||
        s.slug.toLowerCase().includes(needle) ||
        s.description.toLowerCase().includes(needle),
    );
  }, [installed, q]);

  const mergeInstalled = (incoming: SkillChoice[]) => {
    const slugs = new Set(incoming.map((s) => s.slug));
    setInstalled((xs) => [...xs.filter((x) => !slugs.has(x.slug)), ...incoming].sort(byName));
  };

  const pickInstalled = async (s: SkillChoice) => {
    try {
      const res = await fetch(`/api/skills?id=${encodeURIComponent(s.id)}`);
      const j = await readJson<{ skill?: SkillChoice }>(res);
      onPick(j.skill ?? s);
      setOpen(false);
      setMode("list");
      setQ("");
    } catch {
      onPick(s);
      setOpen(false);
      setMode("list");
    }
  };

  const installRemote = async (s: SkillChoice) => {
    if (s.resolvable === false) {
      toast(t("editor.skill.notGithub"), "error");
      return;
    }
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          skillId: s.slug || s.id.split("/").pop(),
          source: s.source,
          installs: s.installs,
        }),
      });
      const j = await readJson<{ skill?: SkillChoice; error?: string }>(res);
      if (!res.ok || !j.skill) throw new Error(j.error || t("editor.skill.installFailed"));
      mergeInstalled([j.skill]);
      onPick(j.skill);
      setOpen(false);
      setMode("list");
      setQ("");
      toast(t("editor.skill.installedToast", { name: j.skill.displayName }), "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.installFailed"), "error");
    }
  };

  const draftWithAI = async () => {
    if (drafting) return;
    if (brief.trim().length < 3) {
      toast(t("editor.skill.describeFirst"), "error");
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/skills/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          name: name.trim() || undefined,
        }),
      });
      const j = await readJson<{ markdown?: string; error?: string }>(res);
      if (!res.ok || !j.markdown) throw new Error(j.error || t("editor.skill.draftFailed"));
      const parsed = parseSkillMd(j.markdown);
      setName(parsed.displayName || parsed.name || name);
      setDescription(parsed.description || description);
      setBody(parsed.body || parsed.description || "");
      toast(t("editor.skill.draftReady"), "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.draftFailed"), "error");
    } finally {
      setDrafting(false);
    }
  };

  const pullRef = async () => {
    const ref = refInput.trim();
    if (!ref || pulling) return;
    setPulling(true);
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ref }),
      });
      const j = await readJson<{
        skill?: SkillChoice;
        skills?: SkillChoice[];
        error?: string;
      }>(res);
      if (!res.ok || !j.skills?.length) {
        throw new Error(j.error || t("editor.skill.pullFailed"));
      }
      mergeInstalled(j.skills);
      if (j.skills.length === 1) {
        onPick(j.skill ?? j.skills[0]);
        setOpen(false);
        setMode("list");
        toast(t("editor.skill.installedToast", { name: j.skills[0].displayName }), "ok");
      } else {
        setMode("list");
        toast(tn("editor.skill.pulled", j.skills.length), "ok");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.pullFailed"), "error");
    } finally {
      setPulling(false);
    }
  };

  const importFile = async (file: File) => {
    if (importingFile) return;
    setImportingFile(true);
    try {
      const text = await file.text();
      const payload = file.name.toLowerCase().endsWith(".json")
        ? { bundle: JSON.parse(text) }
        : { markdown: text };
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await readJson<{ skills?: SkillChoice[]; error?: string }>(res);
      if (!res.ok || !j.skills?.length) {
        throw new Error(j.error || t("editor.skill.nothingImported"));
      }
      mergeInstalled(j.skills);
      setOpen(false);
      setMode("list");
      toast(tn("editor.skill.imported", j.skills.length), "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.importFailed"), "error");
    } finally {
      setImportingFile(false);
    }
  };

  const downloadSkill = async (s: SkillChoice) => {
    try {
      const res = await fetch(`/api/skills/export?id=${encodeURIComponent(s.id)}`);
      if (!res.ok) throw new Error(t("editor.skill.exportFailed"));
      saveBlob(`${s.slug}-SKILL.md`, await res.blob());
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.exportFailed"), "error");
    }
  };

  const exportLibrary = async () => {
    try {
      const res = await fetch("/api/skills/export");
      if (!res.ok) throw new Error(t("editor.skill.exportFailed"));
      saveBlob("kun-skills.json", await res.blob());
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.exportFailed"), "error");
    }
  };

  const saveLocal = async () => {
    if (saving) return;
    if (!body.trim() && !name.trim()) {
      toast(t("editor.skill.needNameOrBody"), "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: name.trim() || undefined,
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          body: body.trim(),
        }),
      });
      const j = await readJson<{ skill?: SkillChoice; error?: string }>(res);
      if (!res.ok || !j.skill) throw new Error(j.error || t("editor.skill.saveFailed"));
      mergeInstalled([j.skill]);
      onPick(j.skill);
      setMode("list");
      setOpen(false);
      setQ("");
      toast(t("editor.skill.savedToast", { name: j.skill.displayName }), "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("editor.skill.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={box} className={compact ? "relative max-w-full" : "relative"}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`nodrag kun-chip-select flex items-center justify-between gap-2 bg-none pe-2.5 text-start ${
          compact ? "w-auto" : "w-full"
        } ${selected ? "!text-ink" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Sparkle size={11} weight={selected ? "fill" : "bold"} aria-hidden />
          <span dir="auto" className="truncate">
            {selected
              ? selected.displayName
              : compact
                ? t("editor.skill.noSkill")
                : t("editor.skill.pick")}
          </span>
        </span>
        <CaretDown size={10} weight="bold" aria-hidden />
      </button>
      {selected && (
        <button
          type="button"
          aria-label={t("editor.skill.clear")}
          onClick={() => onPick(null)}
          className="nodrag absolute end-7 top-1/2 z-10 -translate-y-1/2 rounded-full px-1.5 text-[12px] leading-none text-faint transition-colors hover:bg-ink/10 hover:text-ink"
        >
          ×
        </button>
      )}
      {open && mode === "create" && (
        <div className="kun-pop nodrag nowheel absolute start-0 w-64 max-w-[calc(100vw-2rem)] z-40 mt-1 rounded-lg border border-line2 bg-card p-2 shadow-xl">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            {t("editor.skill.newSkill")}
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            aria-label={t("editor.skill.briefLabel")}
            dir="auto"
            placeholder={t("editor.skill.briefPlaceholder")}
            className="nowheel mb-1 w-full resize-y rounded-md border border-line bg-sunken px-2 py-1 text-[11px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          <div className="mb-2 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => void draftWithAI()}
              disabled={drafting}
              className="rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-canvas disabled:opacity-50"
            >
              {drafting ? t("editor.skill.drafting") : t("editor.skill.draftWithAi")}
            </button>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
              {t("editor.skill.orByHand")}
            </span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            aria-label={t("editor.skill.nameLabel")}
            dir="auto"
            placeholder={t("editor.skill.namePlaceholder")}
            className="mb-1 w-full rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-ink outline-none placeholder:text-faint"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
            aria-label={t("editor.skill.descriptionLabel")}
            dir="auto"
            placeholder={t("editor.skill.descriptionPlaceholder")}
            className="mb-1 w-full rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-ink outline-none placeholder:text-faint"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            aria-label={t("editor.skill.instructionsLabel")}
            dir="auto"
            placeholder={t("editor.skill.instructionsPlaceholder")}
            className="nowheel mb-2 w-full resize-y rounded-md border border-line bg-sunken px-2 py-1 text-[11px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="rounded px-2 py-1 text-[10px] text-faint hover:text-ink"
            >
              {t("common.back")}
            </button>
            <button
              type="button"
              onClick={() => void saveLocal()}
              disabled={saving}
              className="rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-canvas disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("editor.skill.saveToLibrary")}
            </button>
          </div>
        </div>
      )}
      {open && mode === "import" && (
        <div className="kun-pop nodrag nowheel absolute start-0 w-64 max-w-[calc(100vw-2rem)] z-40 mt-1 rounded-lg border border-line2 bg-card p-2 shadow-xl">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            {t("editor.skill.importTitle")}
          </p>
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void pullRef();
              }}
              autoComplete="off"
              spellCheck={false}
              aria-label={t("editor.skill.repoLabel")}
              dir="ltr"
              placeholder={t("editor.skill.repoPlaceholder")}
              className="min-w-0 flex-1 rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-ink outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => void pullRef()}
              disabled={pulling || !refInput.trim()}
              className="shrink-0 rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-canvas disabled:opacity-50"
            >
              {pulling ? t("editor.skill.pulling") : t("editor.skill.pull")}
            </button>
          </div>
          <p className="mt-1 mb-2 text-[10px] leading-relaxed text-faint">
            {t("editor.skill.importHint")}
          </p>
          <label className="mb-2 flex cursor-pointer items-center justify-center rounded-md border border-line px-2 py-1.5 text-[10px] font-medium text-muted transition-colors hover:border-line2 hover:text-ink">
            {importingFile ? t("editor.skill.importing") : t("editor.skill.uploadFile")}
            <input
              type="file"
              accept=".md,.markdown,.json"
              className="hidden"
              disabled={importingFile}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="rounded px-2 py-1 text-[10px] text-faint hover:text-ink"
            >
              {t("common.back")}
            </button>
          </div>
        </div>
      )}
      {open && mode === "list" && (
        <div className="kun-pop nodrag nowheel absolute start-0 w-64 max-w-[calc(100vw-2rem)] z-40 mt-1 max-h-64 overflow-auto rounded-lg border border-line2 bg-card shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            aria-label={t("editor.skill.searchLabel")}
            dir="auto"
            placeholder={t("editor.skill.searchPlaceholder")}
            className="sticky top-0 w-full border-b border-line bg-sunken px-2 py-1.5 text-[11px] text-ink outline-none placeholder:text-faint"
          />
          {localHits.length === 0 && q.trim().length < 2 && (
            <p className="px-2 py-1.5 text-[10px] text-faint">
              {t("editor.skill.noneYet")}
            </p>
          )}
          {localHits.length > 0 && (
            <ul className="py-1">
              {localHits.map((s) => (
                <li key={s.id} className="flex items-center hover:bg-ink/[0.04]">
                  <button
                    type="button"
                    onClick={() => void pickInstalled(s)}
                    className="flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-start"
                  >
                    <span dir="auto" className="text-[11px] text-ink/90">{s.displayName}</span>
                    <span dir="auto" className="line-clamp-2 text-[10px] text-faint">
                      {sourceLabel(t, s.source)} · {s.description || s.slug}
                    </span>
                  </button>
                  <button
                    type="button"
                    title={t("editor.skill.downloadMd")}
                    aria-label={t("editor.skill.downloadNamed", { name: s.displayName })}
                    onClick={() => void downloadSkill(s)}
                    className="nodrag shrink-0 rounded px-1.5 py-1.5 text-[10px] text-faint transition-colors hover:text-ink"
                  >
                    ⤓
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(q.trim().length >= 2 || loading) && (
            <div className="border-t border-line py-1">
              <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint rtl:tracking-normal">
                {loading ? t("editor.skill.searching") : "skills.sh"}
              </p>
              {remote
                .filter((s) => !installed.some((i) => i.slug === s.slug || i.registryId === s.id))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void installRemote(s)}
                    className="flex w-full flex-col items-start px-2 py-1.5 text-start hover:bg-ink/[0.04]"
                  >
                    <span className="text-[11px] text-ink/90">{s.displayName || s.slug}</span>
                    <span className="line-clamp-2 text-[10px] text-faint">
                      {s.resolvable === false ? t("editor.skill.hostedElsewhere") : t("editor.skill.install")} · {s.source}
                    </span>
                  </button>
                ))}
              {!loading && q.trim().length >= 2 && remote.length === 0 && (
                <p className="px-2 py-1.5 text-[10px] text-faint">{t("editor.skill.noRegistry")}</p>
              )}
            </div>
          )}
          <div className="sticky bottom-0 flex items-stretch border-t border-line bg-card text-[11px] text-ink/90">
            <button
              type="button"
              onClick={startCreate}
              className="flex-1 px-2 py-1.5 text-start hover:bg-ink/[0.04]"
            >
              {t("editor.skill.newSkillButton")}
            </button>
            <button
              type="button"
              onClick={startImport}
              className="border-s border-line px-2 py-1.5 hover:bg-ink/[0.04]"
            >
              {t("editor.skill.import")}
            </button>
            <button
              type="button"
              onClick={() => void exportLibrary()}
              title={t("editor.skill.exportAllTitle")}
              className="border-s border-line px-2 py-1.5 hover:bg-ink/[0.04]"
            >
              {t("editor.skill.exportAll")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
