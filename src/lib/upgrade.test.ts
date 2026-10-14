import { describe, expect, it } from "vitest";
import { upgradeGraph } from "./upgrade";
import type { GraphDoc } from "./types";

const node = (id: string, kind: string, label?: string): GraphDoc["nodes"][number] => ({
  id,
  type: "flow",
  position: { x: 0, y: 0 },
  data: { kind, label },
});
const edge = (id: string, source: string, target: string, sourceHandle: string | null, targetHandle: string | null) => ({
  id,
  source,
  sourceHandle,
  target,
  targetHandle,
});

describe("upgradeGraph", () => {
  it("removes Output and pins what fed it, so it stays the project's result", () => {
    const doc: GraphDoc = {
      nodes: [node("g", "image.gen"), node("v", "video.gen"), node("o", "out.media", "Media Out")],
      edges: [edge("a", "g", "o", "out", "in"), edge("b", "v", "o", "out", "video")],
    };
    const next = upgradeGraph(doc);
    expect(next.nodes.map((n) => n.id)).toEqual(["g", "v"]);
    expect(next.nodes.map((n) => n.data.pinned)).toEqual([true, true]);
    expect(next.edges).toEqual([]);
  });

  it("rejoins wires that left the Output from the nodes that fed it", () => {
    const doc: GraphDoc = {
      nodes: [node("img", "image.gen"), node("o", "out.text", "Result"), node("vid", "video.gen")],
      edges: [edge("a", "img", "o", "out", "in"), edge("b", "o", "vid", "out", "image")],
    };
    const next = upgradeGraph(doc);
    expect(next.nodes.map((n) => n.id)).toEqual(["img", "vid"]);
    expect(next.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual([
      ["img", "out", "vid", "image"],
    ]);
  });

  it("leaves other wires and nodes alone", () => {
    const doc: GraphDoc = {
      nodes: [node("t", "text"), node("ai", "llm"), node("o", "out.text")],
      edges: [edge("a", "t", "ai", "out", "in"), edge("b", "ai", "o", "out", "in")],
    };
    const next = upgradeGraph(doc);
    expect(next.edges.map((e) => e.id)).toEqual(["a"]);
    expect(next.nodes.find((n) => n.id === "t")!.data.pinned).toBeUndefined();
    expect(next.nodes.find((n) => n.id === "ai")!.data.pinned).toBe(true);
  });

  it("turns a Skill node into an Instruction and keeps its skill", () => {
    const doc: GraphDoc = {
      nodes: [{ ...node("s", "skill", "Skill"), data: { kind: "skill", label: "Skill", skillId: "brief", text: "Be terse." } }],
      edges: [],
    };
    expect(upgradeGraph(doc).nodes[0].data).toMatchObject({
      kind: "note",
      label: "Instruction",
      skillId: "brief",
      text: "Be terse.",
    });
  });

  it("merges the three upload nodes into File with one out handle", () => {
    const doc: GraphDoc = {
      nodes: [
        { ...node("a", "image.in", "Image"), data: { kind: "image.in", label: "Image", artifactId: "x1" } },
        node("b", "audio.in", "Voiceover"),
        node("c", "video.in", "Video"),
        node("f", "file.in", "File"),
        node("g", "image.gen"),
      ],
      edges: [
        edge("e1", "a", "g", "out", "image"),
        edge("e2", "b", "g", null, "image"),
        edge("e3", "f", "g", "image", "image"),
      ],
    };
    const next = upgradeGraph(doc);
    expect(next.nodes.slice(0, 3).map((n) => [n.data.kind, n.data.mediaType, n.data.label])).toEqual([
      ["file.in", "image", "File"],
      ["file.in", "audio", "Voiceover"],
      ["file.in", "video", "File"],
    ]);
    expect(next.nodes[0].data.artifactId).toBe("x1");
    expect(next.edges.map((e) => e.sourceHandle)).toEqual(["out", "out", "out"]);
  });

  it("is idempotent and returns the same object when already current", () => {
    const doc: GraphDoc = {
      nodes: [node("t", "text"), node("ai", "llm")],
      edges: [edge("a", "t", "ai", "out", "in")],
    };
    expect(upgradeGraph(doc)).toBe(doc);
    const old: GraphDoc = {
      nodes: [node("o", "out.media"), node("i", "image.in")],
      edges: [edge("a", "i", "o", "out", "in")],
    };
    const once = upgradeGraph(old);
    expect(upgradeGraph(once)).toBe(once);
  });

  it("moves a skill off an AI node into an Instruction wired into its prompt", () => {
    const doc: GraphDoc = {
      nodes: [
        { ...node("img", "image.gen", "AI Image"), position: { x: 700, y: 100 }, data: { kind: "image.gen", label: "AI Image", skillId: "cinematic" } },
        { ...node("llm", "llm"), data: { kind: "llm", skillId: "brief" } },
      ],
      edges: [],
    };
    const next = upgradeGraph(doc);
    const added = next.nodes.filter((n) => n.data.kind === "note");
    expect(added.map((n) => [n.id, n.data.skillId])).toEqual([
      ["img-skill", "cinematic"],
      ["llm-skill", "brief"],
    ]);
    expect(added[0].position).toEqual({ x: 360, y: 80 });
    expect(next.nodes.find((n) => n.id === "img")!.data.skillId).toBeUndefined();
    expect(next.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])).toEqual([
      ["img-skill", "out", "img", "prompt"],
      ["llm-skill", "out", "llm", "in"],
    ]);
    // opening it again changes nothing
    expect(upgradeGraph(next)).toBe(next);
  });

  it("moves a typed prompt off an image, video or speech node into a wired Text node", () => {
    const doc: GraphDoc = {
      nodes: [
        { ...node("vid", "video.gen"), position: { x: 800, y: 200 }, data: { kind: "video.gen", prompt: "Slow push-in." } },
        { ...node("say", "tts"), data: { kind: "tts", prompt: "Hello." } },
        { ...node("ai", "llm"), data: { kind: "llm", prompt: "Summarize." } },
      ],
      edges: [],
    };
    const next = upgradeGraph(doc);
    const prompts = next.nodes.filter((n) => n.id.endsWith("-prompt"));
    expect(prompts.map((n) => [n.id, n.data.kind, n.data.text])).toEqual([
      ["vid-prompt", "text", "Slow push-in."],
      ["say-prompt", "text", "Hello."],
    ]);
    expect(prompts[0].position).toEqual({ x: 460, y: 180 });
    expect(next.nodes.find((n) => n.id === "vid")!.data.prompt).toBeUndefined();
    // the text model keeps its own prompt box
    expect(next.nodes.find((n) => n.id === "ai")!.data.prompt).toBe("Summarize.");
    expect(next.edges.map((e) => [e.source, e.target, e.targetHandle])).toEqual([
      ["vid-prompt", "vid", "prompt"],
      ["say-prompt", "say", "text"],
    ]);
    expect(upgradeGraph(next)).toBe(next);
  });

  it("stacks a skill above the prompt when a node has both", () => {
    const doc: GraphDoc = {
      nodes: [
        { ...node("img", "image.gen"), position: { x: 700, y: 300 }, data: { kind: "image.gen", skillId: "film", prompt: "A pier." } },
      ],
      edges: [],
    };
    const next = upgradeGraph(doc);
    const byId = Object.fromEntries(next.nodes.map((n) => [n.id, n.position]));
    expect(byId["img-skill"]).toEqual({ x: 360, y: 110 });
    expect(byId["img-prompt"]).toEqual({ x: 360, y: 280 });
  });
});
