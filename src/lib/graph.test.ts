import { describe, expect, it } from "vitest";
import { inertNodeIds, freshSourceIds } from "./graph";

type N = { id: string; data: { kind: string } };
type E = {
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
};

const node = (id: string, kind: string): N => ({ id, data: { kind } });
const wire = (
  source: string,
  target: string,
  sourceHandle = "out",
  targetHandle = "in",
): E => ({ source, sourceHandle, target, targetHandle });

describe("inertNodeIds", () => {
  it("skips a generation node with no outgoing edge", () => {
    const inert = inertNodeIds(
      [node("t", "text"), node("ai", "llm")],
      [wire("t", "ai")],
    );
    expect([...inert]).toEqual(["ai"]);
  });

  it("keeps a generation node wired to an output", () => {
    const inert = inertNodeIds(
      [node("t", "text"), node("ai", "llm"), node("o", "out.text")],
      [wire("t", "ai"), wire("ai", "o")],
    );
    expect(inert.size).toBe(0);
  });

  it("keeps a whole chain alive through its sink", () => {
    const inert = inertNodeIds(
      [node("ai1", "llm"), node("ai2", "image.gen"), node("o", "out.media")],
      [wire("ai1", "ai2", "out", "prompt"), wire("ai2", "o")],
    );
    expect(inert.size).toBe(0);
  });

  it("skips a chain that dead-ends before any sink", () => {
    const inert = inertNodeIds(
      [node("ai1", "llm"), node("ai2", "image.gen")],
      [wire("ai1", "ai2", "out", "prompt")],
    );
    expect([...inert].sort()).toEqual(["ai1", "ai2"]);
  });

  it("ignores an edge whose two ends carry different types", () => {
    // text out → image in delivers nothing, so the node stays inert
    const inert = inertNodeIds(
      [node("ai", "llm"), node("o", "out.media")],
      [wire("ai", "o", "out", "in")],
    );
    expect([...inert]).toEqual(["ai"]);
  });

  it("treats an unknown handle as connected rather than skipping work", () => {
    const inert = inertNodeIds(
      [node("ai", "llm"), node("o", "out.text")],
      [wire("ai", "o", "stale", "stale")],
    );
    expect(inert.size).toBe(0);
  });

  it("never reports input or output nodes", () => {
    const inert = inertNodeIds(
      [node("t", "text"), node("i", "image.in"), node("o", "out.text")],
      [],
    );
    expect(inert.size).toBe(0);
  });

  it("keeps a node that feeds one live branch and one dead one", () => {
    const inert = inertNodeIds(
      [node("ai", "llm"), node("dead", "tts"), node("o", "out.text")],
      [wire("ai", "o"), wire("ai", "dead", "out", "text")],
    );
    expect([...inert]).toEqual(["dead"]);
  });
});

describe("freshSourceIds", () => {
  it("pulls an upstream Text node into a partial-run scope", () => {
    const fresh = freshSourceIds(
      [node("t", "text"), node("ai", "llm"), node("o", "out.text")],
      [wire("t", "ai"), wire("ai", "o")],
      new Set(["ai", "o"]),
    );
    expect([...fresh]).toEqual(["t"]);
  });

  it("includes uploads and skill nodes, not nodes with inputs", () => {
    const fresh = freshSourceIds(
      [node("img", "image.in"), node("ai", "image.gen")],
      [wire("img", "ai", "out", "image")],
      new Set(["ai"]),
    );
    expect([...fresh]).toEqual(["img"]);
  });

  it("leaves upstream AI nodes on the cached path", () => {
    const fresh = freshSourceIds(
      [node("t", "text"), node("ai1", "llm"), node("ai2", "llm")],
      [wire("t", "ai1"), wire("ai1", "ai2")],
      new Set(["ai2"]),
    );
    expect(fresh.size).toBe(0);
  });

  it("does not re-add sources already inside the scope", () => {
    const fresh = freshSourceIds(
      [node("t", "text"), node("ai", "llm")],
      [wire("t", "ai")],
      new Set(["t", "ai"]),
    );
    expect(fresh.size).toBe(0);
  });
});
