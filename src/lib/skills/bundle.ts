import { parseSkillMd } from "./format";

export const SKILLS_BUNDLE_KIND = "kun/skills";
export const SKILLS_BUNDLE_VERSION = 1;

export interface BundleSkill {
  slug: string;
  displayName: string;
  description: string;
  body: string;
}

export interface SkillsBundle {
  kind: typeof SKILLS_BUNDLE_KIND;
  version: number;
  exportedAt?: string;
  skills: BundleSkill[];
}

export function toSkillsBundle(skills: BundleSkill[]): SkillsBundle {
  return {
    kind: SKILLS_BUNDLE_KIND,
    version: SKILLS_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    skills: skills.map((s) => ({
      slug: s.slug,
      displayName: s.displayName,
      description: s.description,
      body: s.body,
    })),
  };
}

/** Lenient reader: accepts our bundles and bare `{ skills: [...] }` payloads. */
export function parseSkillsBundle(raw: unknown): BundleSkill[] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind && o.kind !== SKILLS_BUNDLE_KIND) return null;
  if (!Array.isArray(o.skills)) return null;
  const out: BundleSkill[] = [];
  for (const item of o.skills) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const slug = typeof s.slug === "string" ? s.slug : "";
    const body = typeof s.body === "string" ? s.body : "";
    if (!slug && !body.trim()) continue;
    out.push({
      slug,
      displayName: typeof s.displayName === "string" ? s.displayName : slug,
      description: typeof s.description === "string" ? s.description : "",
      body,
    });
  }
  return out.length ? out : null;
}

/**
 * Render a skill back to a portable SKILL.md. Registry skills already store
 * the full file; locally-created ones store only the body, so we rebuild the
 * frontmatter from the columns.
 */
export function skillToMarkdown(skill: BundleSkill) {
  const body = skill.body.trim();
  if (body.startsWith("---")) {
    const parsed = parseSkillMd(body);
    if (parsed.name || parsed.description) return body;
  }
  const fm = [
    "---",
    `name: ${skill.slug}`,
    skill.displayName && skill.displayName !== skill.slug
      ? `displayName: ${oneLine(skill.displayName)}`
      : null,
    skill.description ? `description: ${oneLine(skill.description)}` : null,
    "---",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  return `${fm}\n\n${body}\n`;
}

function oneLine(text: string) {
  const flat = text.replace(/\s+/g, " ").trim().replace(/"/g, "'");
  return flat.length > 300 ? `${flat.slice(0, 299)}…` : flat;
}
