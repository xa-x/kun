import { parseAndResolve, parseSkillMd } from "./format";
import {
  isGithubSource,
  isSkillMdPath,
  skillDirOf,
  type SkillRef,
} from "./refs";

export { isGithubSource };

const SEARCH_URL = "https://www.skills.sh/api/search";
const RAW = "https://raw.githubusercontent.com";
const API = "https://api.github.com";
const TIMEOUT_MS = 8000;
export const REPO_SKILL_CAP = 20;

export interface RegistryHit {
  id: string;
  skillId: string;
  name: string;
  source: string;
  installs: number;
  resolvable: boolean;
}

export interface FetchedSkill {
  raw: string;
  source: string;
  skillId: string;
  path: string;
}

const searchCache = new Map<string, { at: number; hits: RegistryHit[] }>();
const treeCache = new Map<string, { at: number; paths: string[] }>();
const CACHE_MS = 60_000;

function candidatePaths(skillId: string) {
  const id = skillId.replace(/^\/+|\/+$/g, "");
  return [
    `${id}/SKILL.md`,
    `skills/${id}/SKILL.md`,
    `.claude/skills/${id}/SKILL.md`,
    `.cursor/skills/${id}/SKILL.md`,
  ];
}

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw Object.assign(new Error(`Registry search failed (${res.status})`), {
      status: 502,
    });
  }
  return res.json() as Promise<unknown>;
}

export async function searchRegistry(q: string): Promise<RegistryHit[]> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return [];
  const hit = searchCache.get(query);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.hits;
  const raw = await getJson(`${SEARCH_URL}?q=${encodeURIComponent(query)}`);
  const list =
    raw && typeof raw === "object" && Array.isArray((raw as { skills?: unknown }).skills)
      ? ((raw as { skills: unknown[] }).skills)
      : [];
  const hits: RegistryHit[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const skillId = typeof o.skillId === "string" ? o.skillId : typeof o.name === "string" ? o.name : "";
    const source = typeof o.source === "string" ? o.source : "";
    if (!id || !skillId || seen.has(id)) continue;
    seen.add(id);
    hits.push({
      id,
      skillId,
      name: typeof o.name === "string" ? o.name : skillId,
      source,
      installs: typeof o.installs === "number" ? o.installs : 0,
      resolvable: isGithubSource(source),
    });
    if (hits.length >= 24) break;
  }
  searchCache.set(query, { at: Date.now(), hits });
  return hits;
}

export async function fetchSkillMd(
  source: string,
  skillId: string,
): Promise<FetchedSkill> {
  if (!isGithubSource(source)) {
    throw Object.assign(
      new Error(
        `Skill source "${source}" is not a GitHub repo, so Kun cannot load its SKILL.md.`,
      ),
      { status: 400 },
    );
  }
  let lastStatus = 0;
  for (const path of candidatePaths(skillId)) {
    const url = `${RAW}/${source}/HEAD/${path}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      lastStatus = res.status;
      if (!res.ok) continue;
      const raw = await res.text();
      if (!raw.trim() || raw.startsWith("404")) continue;
      const parsed = parseSkillMd(raw);
      if (!parsed.body && !parsed.description) continue;
      parseAndResolve(raw);
      return { raw, source, skillId, path };
    } catch {
      /* try next path */
    }
  }
  throw Object.assign(
    new Error(
      lastStatus
        ? `Could not find SKILL.md for ${source}/${skillId} (${lastStatus}).`
        : `Could not load SKILL.md for ${source}/${skillId}.`,
    ),
    { status: 404 },
  );
}

/** Fetch one known repo file path (already a `…/SKILL.md`). */
export async function fetchSkillPath(
  source: string,
  path: string,
  branch?: string,
): Promise<string> {
  const ref = branch || "HEAD";
  const res = await fetch(`${RAW}/${source}/${ref}/${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw Object.assign(
      new Error(`Could not load ${source}/${path} (${res.status}).`),
      { status: res.status === 404 ? 404 : 502 },
    );
  }
  const raw = await res.text();
  if (!raw.trim() || raw.startsWith("404")) {
    throw Object.assign(new Error(`No SKILL.md at ${source}/${path}.`), {
      status: 404,
    });
  }
  return raw;
}

/** Every SKILL.md path in a public repo, via the git trees API. */
export async function listRepoSkillPaths(source: string): Promise<string[]> {
  const hit = treeCache.get(source);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.paths;
  let res: Response;
  try {
    res = await fetch(`${API}/repos/${source}/git/trees/HEAD?recursive=1`, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw Object.assign(
      new Error(`Could not reach GitHub for ${source}.`),
      { status: 502 },
    );
  }
  if (res.status === 404) {
    throw Object.assign(
      new Error(`Repo ${source} not found (or private) on GitHub.`),
      { status: 404 },
    );
  }
  if (res.status === 403 || res.status === 429) {
    throw Object.assign(
      new Error("GitHub API rate limit hit — try again in a minute."),
      { status: 429 },
    );
  }
  if (!res.ok) {
    throw Object.assign(
      new Error(`GitHub returned ${res.status} for ${source}.`),
      { status: 502 },
    );
  }
  const data = (await res.json().catch(() => null)) as {
    tree?: { path?: string; type?: string }[];
  } | null;
  const paths = (data?.tree ?? [])
    .filter((e) => e.type === "blob" && typeof e.path === "string")
    .map((e) => e.path as string)
    .filter(
      (p) =>
        isSkillMdPath(p) &&
        !/(^|\/)(node_modules|\.git|\.venv|vendor)\//.test(p),
    )
    .slice(0, 200);
  treeCache.set(source, { at: Date.now(), paths });
  return paths;
}

export interface RefPull {
  raw: string;
  source: string;
  path: string;
  /** Stable per-skill id in the registry shape `owner/repo/skill-dir`. */
  registryId: string;
  skillId: string;
}

/**
 * Resolve a user-pasted ref (repo, repo folder, or SKILL.md URL) to the
 * SKILL.md files it points at — the "pull from source" path. A bare repo
 * pulls every skill found in it, capped at REPO_SKILL_CAP.
 */
export async function fetchSkillsFromRef(ref: SkillRef): Promise<RefPull[]> {
  const { source, branch, path } = ref;
  const pull = async (p: string): Promise<RefPull | null> => {
    try {
      const raw = await fetchSkillPath(source, p, branch);
      const parsed = parseSkillMd(raw);
      if (!parsed.body && !parsed.description) return null;
      const dir = skillDirOf(p);
      const skillId = dir ? dir.split("/").pop()! : parsed.name || "skill";
      return {
        raw,
        source,
        path: p,
        registryId: dir ? `${source}/${dir}` : source,
        skillId,
      };
    } catch {
      return null;
    }
  };

  if (path && isSkillMdPath(path)) {
    const one = await pull(path);
    if (!one) {
      throw Object.assign(
        new Error(`No usable SKILL.md at ${source}/${path}.`),
        { status: 404 },
      );
    }
    return [one];
  }

  if (path) {
    // A folder ref: the folder itself, plus any skills nested under it.
    const direct = await pull(`${path}/SKILL.md`);
    if (direct) return [direct];
    const nested = (await listRepoSkillPaths(source))
      .filter((p) => skillDirOf(p).startsWith(`${path}/`))
      .slice(0, REPO_SKILL_CAP);
    const pulls = (
      await Promise.all(nested.map((p) => pull(p)))
    ).filter((x): x is RefPull => x !== null);
    if (pulls.length) return pulls;
    throw Object.assign(
      new Error(`No SKILL.md found under ${source}/${path}.`),
      { status: 404 },
    );
  }

  const paths = (await listRepoSkillPaths(source)).slice(0, REPO_SKILL_CAP);
  if (!paths.length) {
    throw Object.assign(
      new Error(`${source} has no SKILL.md files to pull.`),
      { status: 404 },
    );
  }
  const pulls = (
    await Promise.all(paths.map((p) => pull(p)))
  ).filter((x): x is RefPull => x !== null);
  if (!pulls.length) {
    throw Object.assign(
      new Error(`Could not load any SKILL.md from ${source}.`),
      { status: 404 },
    );
  }
  return pulls;
}
