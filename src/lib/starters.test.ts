import { describe, expect, it } from "vitest";
import { composeBrief, MAX_PICKS, STARTERS } from "./starters";

describe("composeBrief", () => {
  it("is empty with nothing picked and nothing typed", () => {
    expect(composeBrief([])).toBe("");
    expect(composeBrief([], "  ")).toBe("");
  });

  it("passes typed text through when nothing is picked", () => {
    expect(composeBrief([], "a podcast cover")).toBe("a podcast cover");
  });

  it("lists the picks in the order they were chosen", () => {
    const brief = composeBrief(["summarize", "voice", "cover"]);
    expect(brief).toContain("summarizes it in a few bullet points, then reads the text aloud as speech, and finally makes a cover image");
    expect(brief.indexOf("summarizes")).toBeLessThan(brief.indexOf("reads"));
    expect(brief).not.toMatch(/Output/);
  });

  it("reads naturally for one pick and appends details", () => {
    expect(composeBrief(["cover"], "dark, moody")).toBe(
      "Build one project that makes a cover image from the text. Keep it minimal, one node per step, feeding each step into the next where it makes sense. Details: dark, moody",
    );
  });

  it("ignores ids that are not starters", () => {
    expect(composeBrief(["nope"])).toBe("");
  });
});

describe("STARTERS", () => {
  it("has unique ids and room to pick several", () => {
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(STARTERS.length);
    expect(STARTERS.length).toBeGreaterThan(MAX_PICKS);
  });
});
