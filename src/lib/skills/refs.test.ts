import { describe, expect, it } from "vitest";
import { isSkillMdPath, parseSkillRef, skillDirOf } from "./refs";

describe("parseSkillRef", () => {
  it("accepts bare owner/repo", () => {
    expect(parseSkillRef("anthropics/skills")).toEqual({
      source: "anthropics/skills",
    });
  });

  it("accepts owner/repo with a folder path", () => {
    expect(parseSkillRef("anthropics/skills/document-skills/docx")).toEqual({
      source: "anthropics/skills",
      path: "document-skills/docx",
    });
  });

  it("accepts plain github.com repo URLs", () => {
    expect(parseSkillRef("https://github.com/anthropics/skills")).toEqual({
      source: "anthropics/skills",
    });
    expect(parseSkillRef("https://www.github.com/anthropics/skills/")).toEqual({
      source: "anthropics/skills",
    });
  });

  it("extracts branch and path from tree URLs", () => {
    expect(
      parseSkillRef("https://github.com/anthropics/skills/tree/main/document-skills/docx"),
    ).toEqual({
      source: "anthropics/skills",
      branch: "main",
      path: "document-skills/docx",
    });
  });

  it("extracts branch and file from blob URLs", () => {
    expect(
      parseSkillRef("https://github.com/anthropics/skills/blob/main/skills/foo/SKILL.md"),
    ).toEqual({
      source: "anthropics/skills",
      branch: "main",
      path: "skills/foo/SKILL.md",
    });
  });

  it("handles raw.githubusercontent URLs and normalizes HEAD", () => {
    expect(
      parseSkillRef("https://raw.githubusercontent.com/owner/repo/main/a/SKILL.md"),
    ).toEqual({ source: "owner/repo", branch: "main", path: "a/SKILL.md" });
    expect(
      parseSkillRef("https://raw.githubusercontent.com/owner/repo/HEAD/a/SKILL.md"),
    ).toEqual({ source: "owner/repo", path: "a/SKILL.md" });
  });

  it("accepts scp-style git remotes", () => {
    expect(parseSkillRef("git@github.com:owner/repo.git")).toEqual({
      source: "owner/repo",
    });
  });

  it("rejects junk, other hosts, and too-short input", () => {
    expect(parseSkillRef("not a ref at all")).toBeNull();
    expect(parseSkillRef("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseSkillRef("owner")).toBeNull();
    expect(parseSkillRef("")).toBeNull();
  });
});

describe("skill paths", () => {
  it("finds SKILL.md paths case-insensitively at any depth", () => {
    expect(isSkillMdPath("SKILL.md")).toBe(true);
    expect(isSkillMdPath("skills/foo/SKILL.md")).toBe(true);
    expect(isSkillMdPath(".claude/skills/bar/skill.md")).toBe(true);
    expect(isSkillMdPath("docs/README.md")).toBe(false);
    expect(isSkillMdPath("skills/foo/SKILL.mdx")).toBe(false);
  });

  it("returns the containing folder", () => {
    expect(skillDirOf("skills/foo/SKILL.md")).toBe("skills/foo");
    expect(skillDirOf("SKILL.md")).toBe("");
  });
});
