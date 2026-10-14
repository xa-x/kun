import { describe, expect, it } from "vitest";
import { coverOf, pickShowcaseMedia, trendingScore } from "./community";
import type { GraphDoc } from "./types";

const node = (id: string, x: number, data: Record<string, unknown>) => ({
  id,
  type: "flow",
  position: { x, y: 0 },
  data: { kind: "image.gen", ...data },
});

describe("pickShowcaseMedia", () => {
  it("lists pinned results first, then left to right, skipping text and duplicates", () => {
    const doc = {
      nodes: [
        node("a", 300, { outputs: [{ type: "image", artifactId: "img-b" }] }),
        node("b", 100, { outputs: [{ type: "text", text: "hi" }, { type: "audio", artifactId: "snd" }] }),
        node("c", 500, { pinned: true, outputs: [{ type: "video", artifactId: "vid" }, { type: "image", artifactId: "img-b" }] }),
        node("d", 0, { kind: "comment", outputs: [{ type: "image", artifactId: "nope" }] }),
      ],
    } as unknown as GraphDoc;
    expect(pickShowcaseMedia(doc).map((m) => m.id)).toEqual(["vid", "img-b", "snd"]);
  });

  it("stops at the cap", () => {
    const outputs = Array.from({ length: 9 }, (_, i) => ({ type: "image", artifactId: `i${i}` }));
    const doc = { nodes: [node("a", 0, { outputs })] } as unknown as GraphDoc;
    expect(pickShowcaseMedia(doc, 4)).toHaveLength(4);
  });
});

describe("coverOf", () => {
  it("prefers a picture, then a clip, never sound", () => {
    expect(coverOf([{ id: "s", kind: "audio" }, { id: "v", kind: "video" }, { id: "i", kind: "image" }])?.id).toBe("i");
    expect(coverOf([{ id: "s", kind: "audio" }, { id: "v", kind: "video" }])?.id).toBe("v");
    expect(coverOf([{ id: "s", kind: "audio" }])).toBeNull();
  });
});

describe("trendingScore", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  it("favours engagement and decays with age", () => {
    const fresh = trendingScore({ likeCount: 2, cloneCount: 1, createdAt: "2026-10-15T10:00:00Z" }, now);
    const old = trendingScore({ likeCount: 2, cloneCount: 1, createdAt: "2026-10-01T10:00:00Z" }, now);
    const loved = trendingScore({ likeCount: 20, cloneCount: 5, createdAt: "2026-10-15T10:00:00Z" }, now);
    expect(fresh).toBeGreaterThan(old);
    expect(loved).toBeGreaterThan(fresh);
  });
});
