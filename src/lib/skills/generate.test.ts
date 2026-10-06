import { describe, expect, it } from "vitest";
import {
  buildSkillSystemPrompt,
  buildSkillUserPrompt,
  extractSkillMarkdown,
  guessSkillKind,
} from "./generate";

describe("buildSkill prompts", () => {
  it("keeps the SKILL.md contract in the system prompt per kind", () => {
    const image = buildSkillSystemPrompt("image");
    expect(image).toContain("## Prompting");
    expect(image).toContain("name:");
    const text = buildSkillSystemPrompt("text");
    expect(text).toContain("## Output");
    expect(text).not.toContain("Include a '## Prompting' section with one compact");
  });

  it("carries the brief and optional name", () => {
    const p = buildSkillUserPrompt("Cold emails for developers", { name: "Cold outreach" });
    expect(p).toContain("Cold emails for developers");
    expect(p).toContain("Cold outreach");
    expect(buildSkillUserPrompt("Just a brief")).not.toContain("Suggested name");
  });
});

describe("extractSkillMarkdown", () => {
  it("passes clean SKILL.md replies through", () => {
    const md = "---\nname: x\n---\n\nBody.";
    expect(extractSkillMarkdown(md)).toBe(md);
  });

  it("unwraps code fences", () => {
    const md = "---\nname: x\n---\n\nBody.";
    expect(extractSkillMarkdown("```markdown\n" + md + "\n```")).toBe(md);
  });

  it("converts a fenced frontmatter block into --- form", () => {
    const out = extractSkillMarkdown(
      "```yaml\nname: x\ndisplayName: X\ndescription: Y\n```\n# X\n\nBody.",
    );
    expect(out).toBe("---\nname: x\ndisplayName: X\ndescription: Y\n---\n# X\n\nBody.");
  });

  it("drops chatter before the frontmatter", () => {
    const out = extractSkillMarkdown(
      "Here is your skill:\n\n---\nname: x\ndescription: y\n---\n\nBody.",
    );
    expect(out).not.toContain("Here is your skill");
    expect(out).toContain("name: x");
  });

  it("keeps frontmatter-free drafts instead of losing them", () => {
    expect(extractSkillMarkdown("Five bullets, max 12 words each.")).toBe(
      "Five bullets, max 12 words each.",
    );
    expect(extractSkillMarkdown("   ")).toBeNull();
  });
});

describe("guessSkillKind", () => {
  it("maps brief wording to node kinds", () => {
    expect(guessSkillKind("narration voiceover for docs")).toBe("voice");
    expect(guessSkillKind("one-shot storyboard video look")).toBe("video");
    expect(guessSkillKind("cinematic product photo style")).toBe("image");
    expect(guessSkillKind("summarize articles into bullets")).toBe("text");
    expect(guessSkillKind("something else")).toBe("generic");
  });
});
