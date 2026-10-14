import { describe, expect, it } from "vitest";
import { compatibleKinds } from "./nodes";

const kinds = (type: Parameters<typeof compatibleKinds>[0], side: "out" | "in") =>
  compatibleKinds(type, side).map((d) => d.type);

describe("compatibleKinds", () => {
  it("offers the nodes that take text after a text output", () => {
    expect(kinds("text", "out")).toEqual(
      expect.arrayContaining(["llm", "image.gen", "video.gen", "tts"]),
    );
    expect(kinds("text", "out")).not.toContain("text");
  });

  it("offers the nodes that take an image after an image output", () => {
    const k = kinds("image", "out");
    expect(k).toEqual(expect.arrayContaining(["llm", "image.gen", "video.gen"]));
    expect(k).not.toContain("tts");
  });

  it("has nothing after audio or video, which no node takes yet", () => {
    expect(kinds("audio", "out")).toEqual([]);
    expect(kinds("video", "out")).toEqual([]);
  });

  it("offers the nodes that can feed a text input", () => {
    const k = kinds("text", "in");
    expect(k).toEqual(expect.arrayContaining(["text", "note", "llm"]));
    expect(k).not.toContain("tts");
  });

  it("offers uploads and image models for an image input", () => {
    expect(kinds("image", "in")).toEqual(expect.arrayContaining(["file.in", "image.gen"]));
  });

  it("never offers comments, groups or retired nodes", () => {
    for (const side of ["out", "in"] as const)
      for (const t of ["text", "image", "any"] as const)
        for (const k of kinds(t, side))
          expect(["comment", "group", "out.text", "out.media", "skill"]).not.toContain(k);
  });
});
