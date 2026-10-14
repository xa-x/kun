import { describe, expect, it } from "vitest";
import { applyGraphOps, autoWireNodes } from "./assistant";
import { matchPorts } from "./nodes";
import { layoutGraph } from "./layout";
import type { GraphDoc } from "./types";

const empty: GraphDoc = { nodes: [], edges: [] };

describe("matchPorts", () => {
  it("wires image → video first-frame, not the prompt handle", () => {
    expect(matchPorts("image.in", "video.gen")).toEqual({
      sourceHandle: "out",
      targetHandle: "image",
    });
  });

  it("wires a File into the media input, not the text prompt", () => {
    expect(matchPorts("file.in", "video.gen")).toEqual({
      sourceHandle: "out",
      targetHandle: "image",
    });
  });

  it("wires text into an AI Image prompt port", () => {
    expect(matchPorts("text", "image.gen")).toEqual({
      sourceHandle: "out",
      targetHandle: "prompt",
    });
  });

  it("wires video → the Output's one input", () => {
    expect(matchPorts("video.gen", "out.text")).toEqual({
      sourceHandle: "out",
      targetHandle: "in",
    });
  });

  it("remaps a bogus in handle to the typed port", () => {
    expect(matchPorts("image.in", "video.gen", "out", "in")).toEqual({
      sourceHandle: "out",
      targetHandle: "image",
    });
  });
});

describe("applyGraphOps", () => {
  it("adds a pipeline and connects typed edges even without connect ops", () => {
    const next = applyGraphOps(empty, [
      { op: "add_node", id: "img", kind: "image.in", label: "Image" },
      { op: "add_node", id: "vid", kind: "video.gen", label: "AI Video" },
    ]);
    // a retired upload kind the model still asks for lands on File
    expect(next.nodes.map((n) => n.data.kind)).toEqual(["file.in", "video.gen"]);
    expect(next.edges).toEqual([
      expect.objectContaining({ sourceHandle: "out", targetHandle: "image" }),
    ]);
  });

  it("does not add an Output node: every node shows its own result", () => {
    const next = applyGraphOps(empty, [
      { op: "add_node", id: "ai", kind: "llm" },
      { op: "add_node", id: "out", kind: "out.media", label: "Media Out" },
      { op: "add_node", id: "out2", kind: "out.text" },
    ]);
    expect(next.nodes.map((n) => n.data.kind)).toEqual(["llm"]);
  });

  it("connects with wrong handles by remapping types", () => {
    const seeded = applyGraphOps(empty, [
      { op: "add_node", id: "img", kind: "image.in" },
      { op: "add_node", id: "vid", kind: "video.gen" },
    ]);
    const next = applyGraphOps(
      { nodes: seeded.nodes, edges: [] },
      [{ op: "connect", source: "img", target: "vid", sourceHandle: "out", targetHandle: "in" }],
    );
    expect(next.edges[0]).toMatchObject({
      sourceHandle: "out",
      targetHandle: "image",
    });
  });
});

describe("autoWireNodes", () => {
  it("does not duplicate existing edges", () => {
    const doc = applyGraphOps(empty, [
      { op: "add_node", id: "a", kind: "text" },
      { op: "add_node", id: "b", kind: "llm" },
      { op: "connect", source: "a", target: "b" },
    ]);
    const ids = doc.nodes.map((n) => n.id);
    const again = autoWireNodes(doc.nodes, doc.edges, ids);
    expect(again).toHaveLength(doc.edges.length);
  });
});

describe("layoutGraph", () => {
  it("places sources left of their targets", () => {
    const doc = applyGraphOps(empty, [
      { op: "add_node", id: "img", kind: "file.in" },
      { op: "add_node", id: "gen", kind: "image.gen" },
      { op: "add_node", id: "vid", kind: "video.gen" },
    ]);
    const laid = layoutGraph(doc);
    const x = Object.fromEntries(
      laid.nodes.map((n) => [n.data.kind, n.position.x]),
    );
    expect(x["file.in"]).toBeLessThan(x["image.gen"]);
    expect(x["image.gen"]).toBeLessThan(x["video.gen"]);
  });
});
