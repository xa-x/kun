import { describe, expect, it } from "vitest";
import { applyRunInputs, inputNames } from "./run-inputs";
import type { GraphDoc } from "./types";

const node = (id: string, kind: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "flow",
  position: { x: 0, y: 0 },
  data: { kind, ...data },
});

const doc: GraphDoc = {
  nodes: [
    node("t1", "text", { label: "Article", text: "old" }),
    node("p1", "text", { label: "Prompt", text: "" }),
    node("n1", "note", { label: "Tone" }),
    node("a", "llm", { prompt: "Summarize" }),
    node("v", "video.gen", { prompt: "keep" }),
  ],
  edges: [],
};

describe("applyRunInputs", () => {
  it("fills Text and Instruction nodes by name, ignoring case", () => {
    const r = applyRunInputs(doc, { article: "new text", Tone: "dry" });
    expect(r.applied).toEqual(["article", "Tone"]);
    expect(r.doc.nodes.find((n) => n.id === "t1")!.data.text).toBe("new text");
    expect(r.doc.nodes.find((n) => n.id === "n1")!.data.text).toBe("dry");
  });

  it("matches by node id too, and sends non-strings as JSON", () => {
    const r = applyRunInputs(doc, { p1: { topic: "launch" } });
    expect(r.doc.nodes.find((n) => n.id === "p1")!.data.text).toBe('{"topic":"launch"}');
  });

  it("reports names that match nothing, and never touches other nodes", () => {
    const r = applyRunInputs(doc, { Missing: "x", Video: "y" });
    expect(r.applied).toEqual([]);
    expect(r.ignored).toEqual(["Missing", "Video"]);
    expect(r.doc.nodes.find((n) => n.id === "v")!.data.prompt).toBe("keep");
  });

  it("leaves the original project untouched", () => {
    applyRunInputs(doc, { Article: "changed" });
    expect(doc.nodes[0].data.text).toBe("old");
  });

  it("returns the same document when there is nothing to apply", () => {
    expect(applyRunInputs(doc, {}).doc).toBe(doc);
    expect(applyRunInputs(doc, null).doc).toBe(doc);
  });
});

describe("inputNames", () => {
  it("lists the Text and Instruction nodes by label", () => {
    expect(inputNames(doc)).toEqual(["Article", "Prompt", "Tone"]);
  });
});
