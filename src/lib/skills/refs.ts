export interface SkillRef {
  /** GitHub repo as `owner/repo`. */
  source: string;
  /** Branch/tag when the ref came from a URL that carried one. */
  branch?: string;
  /** Repo-relative path to a skill folder or a SKILL.md file. */
  path?: string;
}

export function isGithubSource(source: string) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source);
}

const GH_HOST = /^(?:www\.)?github\.com$/i;

/**
 * Accepts the ways people point at skills on GitHub — the same inputs Claude
 * Code's `skills add` understands:
 *   owner/repo
 *   owner/repo/some/folder
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/main/skills/docx
 *   https://github.com/owner/repo/blob/main/skills/docx/SKILL.md
 *   https://raw.githubusercontent.com/owner/repo/main/skills/docx/SKILL.md
 *   git@github.com:owner/repo.git
 */
export function parseSkillRef(input: string): SkillRef | null {
  let raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  if (raw.startsWith("git@github.com:")) {
    raw = raw.slice("git@github.com:".length);
  }
  if (raw.startsWith("https://") || raw.startsWith("http://")) {
    try {
      const url = new URL(raw);
      if (!GH_HOST.test(url.hostname) && url.hostname !== "raw.githubusercontent.com") {
        return null;
      }
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (url.hostname === "raw.githubusercontent.com") {
        // owner / repo / branch / path…
        if (parts.length < 3) return null;
        const [owner, repo, branch, ...rest] = parts;
        const path = rest.join("/");
        if (!path) return null;
        return normalize({ source: `${owner}/${repo}`, branch, path });
      }
      // github.com — optional /tree/<branch>/… or /blob/<branch>/…
      if (parts.length < 2) return null;
      const [owner, repo, kind, branch, ...rest] = parts;
      const source = `${owner}/${repo.replace(/\.git$/, "")}`;
      if ((kind === "tree" || kind === "blob") && branch) {
        return normalize({ source, branch, path: rest.join("/") });
      }
      return normalize({ source, path: [kind, branch, ...rest].filter(Boolean).join("/") });
    } catch {
      return null;
    }
  }
  const bare = raw.replace(/\.git$/, "");
  const parts = bare.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2) return null;
  const [owner, repo, ...rest] = parts;
  return normalize({ source: `${owner}/${repo}`, path: rest.join("/") });
}

function normalize(ref: SkillRef): SkillRef | null {
  if (!isGithubSource(ref.source)) return null;
  const out: SkillRef = { source: ref.source };
  if (ref.branch && ref.branch !== "HEAD") out.branch = ref.branch;
  const path = decodeURIComponent(ref.path ?? "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
  if (path) out.path = path;
  return out;
}

/** The folder a SKILL.md lives in — `skills/foo/SKILL.md` → `skills/foo`. */
export function skillDirOf(path: string) {
  const dir = path.replace(/\/[^/]*$/, "");
  return dir === path ? "" : dir;
}

export function isSkillMdPath(path: string) {
  return /(^|\/)SKILL\.md$/i.test(path);
}
