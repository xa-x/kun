"use client";

import { CaretDown, Sparkle } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { readJson } from "@/lib/http";
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

function sourceLabel(source?: string) {
  if (source === "builtin") return "Bundled";
  if (source === "registry") return "Installed";
  if (source === "local") return "Yours";
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
      toast("That skill isn’t hosted on GitHub, so it can’t be installed.", "error");
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
      if (!res.ok || !j.skill) throw new Error(j.error || "Install failed");
      mergeInstalled([j.skill]);
      onPick(j.skill);
      setOpen(false);
      setMode("list");
      setQ("");
      toast(`Installed ${j.skill.displayName}.`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Install failed", "error");
    }
  };

  const draftWithAI = async () => {
    if (drafting) return;
    if (brief.trim().length < 3) {
      toast("Describe what the skill should do first.", "error");
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
      if (!res.ok || !j.markdown) throw new Error(j.error || "Draft failed");
      const parsed = parseSkillMd(j.markdown);
      setName(parsed.displayName || parsed.name || name);
      setDescription(parsed.description || description);
      setBody(parsed.body || parsed.description || "");
      toast("Draft ready — review, tweak, then save.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Draft failed", "error");
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
        throw new Error(j.error || "Pull failed");
      }
      mergeInstalled(j.skills);
      if (j.skills.length === 1) {
        onPick(j.skill ?? j.skills[0]);
        setOpen(false);
        setMode("list");
        toast(`Installed ${j.skills[0].displayName}.`, "ok");
      } else {
        setMode("list");
        toast(`Pulled ${j.skills.length} skills from that repo.`, "ok");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Pull failed", "error");
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
        throw new Error(j.error || "Nothing imported — is that a SKILL.md or a skills bundle?");
      }
      mergeInstalled(j.skills);
      setOpen(false);
      setMode("list");
      toast(`Imported ${j.skills.length} skill${j.skills.length === 1 ? "" : "s"}.`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setImportingFile(false);
    }
  };

  const downloadSkill = async (s: SkillChoice) => {
    try {
      const res = await fetch(`/api/skills/export?id=${encodeURIComponent(s.id)}`);
      if (!res.ok) throw new Error("Export failed");
      saveBlob(`${s.slug}-SKILL.md`, await res.blob());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    }
  };

  const exportLibrary = async () => {
    try {
      const res = await fetch("/api/skills/export");
      if (!res.ok) throw new Error("Export failed");
      saveBlob("kun-skills.json", await res.blob());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    }
  };

  const saveLocal = async () => {
    if (saving) return;
    if (!body.trim() && !name.trim()) {
      toast("Give the skill a name or some instructions.", "error");
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
      if (!res.ok || !j.skill) throw new Error(j.error || "Save failed");
      mergeInstalled([j.skill]);
      onPick(j.skill);
      setMode("list");
      setOpen(false);
      setQ("");
      toast(`Saved “${j.skill.displayName}”. Pick it on any node.`, "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`nodrag kun-chip-select flex w-full items-center justify-between gap-2 bg-none pr-2.5 text-left ${
          selected ? "!text-ink" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Sparkle size={11} weight={selected ? "fill" : "bold"} aria-hidden />
          <span className="truncate">
            {selected
              ? selected.displayName
              : compact
                ? "No skill"
                : "Pick a skill…"}
          </span>
        </span>
        <CaretDown size={10} weight="bold" aria-hidden />
      </button>
      {selected && (
        <button
          type="button"
          aria-label="Clear selected skill"
          onClick={() => onPick(null)}
          className="nodrag absolute right-7 top-1/2 z-10 -translate-y-1/2 rounded-full px-1.5 text-[12px] leading-none text-faint transition-colors hover:bg-ink/10 hover:text-ink"
        >
          ×
        </button>
      )}
      {open && mode === "create" && (
        <div className="kun-pop nodrag nowheel absolute left-0 right-0 z-40 mt-1 rounded-lg border border-line2 bg-card p-2 shadow-xl">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            New skill
          </p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={2}
            aria-label="What the skill should do"
            placeholder="Describe what the skill should do — the AI drafts it…"
            className="nowheel mb-1 w-full resize-y rounded-md border border-line bg-sunken px-2 py-1 text-[11px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          <div className="mb-2 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => void draftWithAI()}
              disabled={drafting}
              className="rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-canvas disabled:opacity-50"
            >
              {drafting ? "Drafting…" : "✦ Draft with AI"}
            </button>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
              or write it by hand
            </span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            aria-label="Skill name"
            placeholder="Name — e.g. cinematic product…"
            className="mb-1 w-full rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-ink outline-none placeholder:text-faint"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            autoComplete="off"
            aria-label="Skill description"
            placeholder="When to use this skill…"
            className="mb-1 w-full rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-ink outline-none placeholder:text-faint"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            aria-label="Skill instructions"
            placeholder="Instructions the model should follow…"
            className="nowheel mb-2 w-full resize-y rounded-md border border-line bg-sunken px-2 py-1 text-[11px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="rounded px-2 py-1 text-[10px] text-faint hover:text-ink"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void saveLocal()}
              disabled={saving}
              className="rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-canvas disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to library"}
            </button>
          </div>
        </div>
      )}
      {open && mode === "import" && (
        <div className="kun-pop nodrag nowheel absolute left-0 right-0 z-40 mt-1 rounded-lg border border-line2 bg-card p-2 shadow-xl">
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
            Import skills
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
              aria-label="GitHub repo or skills folder URL"
              placeholder="github.com/owner/repo or a skills folder URL…"
              className="min-w-0 flex-1 rounded-md border border-line bg-sunken px-2 py-1 text-[11px] text-ink outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => void pullRef()}
              disabled={pulling || !refInput.trim()}
              className="shrink-0 rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-canvas disabled:opacity-50"
            >
              {pulling ? "Pulling…" : "Pull"}
            </button>
          </div>
          <p className="mt-1 mb-2 text-[10px] leading-relaxed text-faint">
            Pulls SKILL.md files from any public GitHub repo — the repo root, a
            folder, or a raw SKILL.md URL.
          </p>
          <label className="mb-2 flex cursor-pointer items-center justify-center rounded-md border border-line px-2 py-1.5 text-[10px] font-medium text-muted transition-colors hover:border-line2 hover:text-ink">
            {importingFile ? "Importing…" : "Upload SKILL.md or skills bundle (.json)"}
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
              Back
            </button>
          </div>
        </div>
      )}
      {open && mode === "list" && (
        <div className="kun-pop nodrag nowheel absolute left-0 right-0 z-40 mt-1 max-h-64 overflow-auto rounded-lg border border-line2 bg-card shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            aria-label="Search skills"
            placeholder="Search installed or skills.sh…"
            className="sticky top-0 w-full border-b border-line bg-sunken px-2 py-1.5 text-[11px] text-ink outline-none placeholder:text-faint"
          />
          {localHits.length === 0 && q.trim().length < 2 && (
            <p className="px-2 py-1.5 text-[10px] text-faint">
              No skills yet — create one or import below.
            </p>
          )}
          {localHits.length > 0 && (
            <ul className="py-1">
              {localHits.map((s) => (
                <li key={s.id} className="flex items-center hover:bg-ink/[0.04]">
                  <button
                    type="button"
                    onClick={() => void pickInstalled(s)}
                    className="flex min-w-0 flex-1 flex-col items-start px-2 py-1.5 text-left"
                  >
                    <span className="text-[11px] text-ink/90">{s.displayName}</span>
                    <span className="line-clamp-2 text-[10px] text-faint">
                      {sourceLabel(s.source)} · {s.description || s.slug}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Download SKILL.md"
                    aria-label={`Download ${s.displayName} SKILL.md`}
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
              <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                {loading ? "Searching skills.sh…" : "skills.sh"}
              </p>
              {remote
                .filter((s) => !installed.some((i) => i.slug === s.slug || i.registryId === s.id))
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void installRemote(s)}
                    className="flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-ink/[0.04]"
                  >
                    <span className="text-[11px] text-ink/90">{s.displayName || s.slug}</span>
                    <span className="line-clamp-2 text-[10px] text-faint">
                      {s.resolvable === false ? "Hosted elsewhere · " : "Install · "}
                      {s.source}
                    </span>
                  </button>
                ))}
              {!loading && q.trim().length >= 2 && remote.length === 0 && (
                <p className="px-2 py-1.5 text-[10px] text-faint">No registry matches.</p>
              )}
            </div>
          )}
          <div className="sticky bottom-0 flex items-stretch border-t border-line bg-card text-[11px] text-ink/90">
            <button
              type="button"
              onClick={startCreate}
              className="flex-1 px-2 py-1.5 text-left hover:bg-ink/[0.04]"
            >
              + New skill
            </button>
            <button
              type="button"
              onClick={startImport}
              className="border-l border-line px-2 py-1.5 hover:bg-ink/[0.04]"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => void exportLibrary()}
              title="Download the whole library as a bundle"
              className="border-l border-line px-2 py-1.5 hover:bg-ink/[0.04]"
            >
              Export all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
