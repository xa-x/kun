import { describe, expect, it } from "vitest";
import { hasUnpublishedChanges, publishDoc } from "./publish";
import type { GraphDoc } from "./types";

const node = (id: string, kind: string, data: Record<string, unknown> = {}, x = 0) => ({
  id,
  type: "flow",
  position: { x, y: 0 },
  data: { kind, ...data },
});

const live: GraphDoc = {
  nodes: [node("t", "text", { text: "hi" }), node("a", "llm", { model: "m/x", prompt: "p" })],
  edges: [{ id: "e", source: "t", sourceHandle: "out", target: "a", targetHandle: "in" }],
};

describe("hasUnpublishedChanges", () => {
  it("is true when nothing was ever published", () => {
    expect(hasUnpublishedChanges(live, null)).toBe(true);
  });

  it("ignores moving, renaming, comments, groups and run results", () => {
    const published = publishDoc(live);
    const tidied: GraphDoc = {
      nodes: [
        node("t", "text", { text: "hi", label: "Brief" }, 400),
        node("a", "llm", { model: "m/x", prompt: "p", runStatus: "done", outputs: [{ type: "text", text: "x" }], group: "g" }, 800),
        node("n", "comment", { text: "remember" }),
        node("g", "group", { w: 300, h: 200 }),
      ],
      edges: live.edges,
    };
    expect(hasUnpublishedChanges(tidied, published)).toBe(false);
  });

  it("notices a changed prompt, model, node or wire", () => {
    const published = publishDoc(live);
    const edit = (patch: Record<string, unknown>): GraphDoc => ({
      ...live,
      nodes: live.nodes.map((n) => (n.id === "a" ? { ...n, data: { ...n.data, ...patch } } : n)),
    });
    expect(hasUnpublishedChanges(edit({ prompt: "different" }), published)).toBe(true);
    expect(hasUnpublishedChanges(edit({ model: "m/y" }), published)).toBe(true);
    expect(hasUnpublishedChanges({ ...live, edges: [] }, published)).toBe(true);
    expect(hasUnpublishedChanges({ ...live, nodes: [...live.nodes, node("x", "tts")] }, published)).toBe(true);
  });

  it("stamps the publish time", () => {
    expect(publishDoc(live).publishedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });
});
