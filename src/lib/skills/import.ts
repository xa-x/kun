import { parseSkillRef } from "./refs";
import { fetchSkillsFromRef } from "./registry";
import { parseAndResolve, slugify } from "./format";
import { upsertSkill, type SkillRecord } from "./store";

/** Pull skills from a pasted GitHub ref (repo / folder / SKILL.md URL). */
export async function installRefSkills(
  orgId: string,
  userId: string,
  ref: string,
): Promise<SkillRecord[]> {
  const parsed = parseSkillRef(ref);
  if (!parsed) {
    throw Object.assign(
      new Error(
        "That doesn't look like a GitHub source — try owner/repo, a repo folder URL, or a raw SKILL.md URL.",
      ),
      { status: 400 },
    );
  }
  const pulls = await fetchSkillsFromRef(parsed);
  const out: SkillRecord[] = [];
  const seen = new Set<string>();
  for (const p of pulls) {
    const resolved = parseAndResolve(p.raw);
    const slug = slugify(resolved.slug || p.skillId);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(
      await upsertSkill({
        orgId,
        userId,
        source: "registry",
        slug,
        displayName: resolved.displayName,
        description: resolved.description,
        body: p.raw,
        registryId: p.registryId,
      }),
    );
  }
  if (!out.length) {
    throw Object.assign(
      new Error("No installable skills were found at that source."),
      { status: 404 },
    );
  }
  return out;
}
