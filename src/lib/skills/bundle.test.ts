import { describe, expect, it } from "vitest";
import { parseSkillsBundle, skillToMarkdown, toSkillsBundle } from "./bundle";
import { parseSkillMd } from "./format";

describe("skillToMarkdown", () => {
  it("rebuilds frontmatter for body-only skills", () => {
    const md = skillToMarkdown({
      slug: "my-skill",
      displayName: "My Skill",
      description: "Does a thing.",
      body: "# My Skill\n\nDo the thing.",
    });
    expect(md.startsWith("---")).toBe(true);
    const parsed = parseSkillMd(md);
    expect(parsed.name).toBe("my-skill");
    expect(parsed.displayName).toBe("My Skill");
    expect(parsed.description).toBe("Does a thing.");
    expect(parsed.body).toContain("Do the thing.");
  });

  it("keeps full SKILL.md bodies as-is", () => {
    const full = `---\nname: pulled\ndescription: From a repo.\n---\n\n# Pulled\n\nBody text.`;
    expect(skillToMarkdown({ slug: "pulled", displayName: "Pulled", description: "From a repo.", body: full })).toBe(full);
  });

  it("flattens multiline descriptions into one frontmatter line", () => {
    const md = skillToMarkdown({
      slug: "s",
      displayName: "S",
      description: "line one\nline two",
      body: "Body.",
    });
    expect(md).toContain("description: line one line two");
  });
});

describe("skills bundle", () => {
  it("round-trips through parseSkillsBundle", () => {
    const bundle = toSkillsBundle([
      { slug: "a", displayName: "A", description: "First", body: "Body A" },
      { slug: "b", displayName: "B", description: "", body: "Body B" },
    ]);
    expect(bundle.kind).toBe("kun/skills");
    const parsed = parseSkillsBundle(JSON.parse(JSON.stringify(bundle)));
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed![0]).toMatchObject({ slug: "a", body: "Body A" });
  });

  it("accepts bare { skills: [...] } payloads", () => {
    const parsed = parseSkillsBundle({ skills: [{ slug: "x", body: "B" }] });
    expect(parsed).toEqual([{ slug: "x", displayName: "x", description: "", body: "B" }]);
  });

  it("rejects other bundles and empty arrays", () => {
    expect(parseSkillsBundle({ kind: "kun/workbook", nodes: [] })).toBeNull();
    expect(parseSkillsBundle({ skills: [] })).toBeNull();
    expect(parseSkillsBundle("nope")).toBeNull();
    expect(parseSkillsBundle(null)).toBeNull();
  });
});
