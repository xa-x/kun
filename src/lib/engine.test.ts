import { describe, expect, it, vi } from "vitest";
import type { GraphDoc, RunEvent } from "./types";

// The engine persists best-effort through drizzle; with no graphId it never
// should, but the import must not reach for a real database.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ runs: {}, runNodes: {}, usageLedger: {} }));

const { executeGraph } = await import("./engine");

const node = (id: string, kind: string, text?: string) => ({
  id,
  type: "flow",
  position: { x: 0, y: 0 },
  data: { kind, text },
});
const edge = (source: string, target: string, sh = "out", th = "in") => ({
  id: `${source}-${target}`,
  source,
  sourceHandle: sh,
  target,
  targetHandle: th,
});

async function run(graph: GraphDoc, opts = {}) {
  const seen: string[] = [];
  for await (const ev of executeGraph(graph, opts) as AsyncIterable<RunEvent>) {
    if (ev.type === "node" && ev.status === "done") seen.push(ev.nodeId);
  }
  return seen;
}

const graph: GraphDoc = {
  nodes: [
    node("t1", "text", "one"),
    node("o1", "out.text"),
    node("t2", "text", "two"),
    node("o2", "out.text"),
    node("note", "comment", "remember this"),
    node("box", "group"),
  ],
  edges: [edge("t1", "o1"), edge("t2", "o2")],
};

describe("executeGraph", () => {
  it("never runs comments or groups", async () => {
    const done = await run(graph);
    expect(done.sort()).toEqual(["o1", "o2", "t1", "t2"]);
  });

  it("runs just the nodes of a group, leaving the rest alone", async () => {
    const done = await run(graph, { nodes: ["t2", "o2"] });
    expect(done.sort()).toEqual(["o2", "t2"]);
  });

  it("runs every node when the project has no Output, leaving nothing unused", async () => {
    const g: GraphDoc = {
      nodes: [node("t", "text", "hi"), node("a", "note", "an instruction")],
      edges: [],
    };
    expect((await run(g)).sort()).toEqual(["a", "t"]);
  });

  it("skips a frozen node and serves its saved result to what follows", async () => {
    const g: GraphDoc = {
      nodes: [
        { ...node("src", "text", "fresh"), data: { kind: "text", text: "fresh", frozen: true, outputs: [{ type: "text", text: "kept" }] } },
        node("tail", "text"),
      ],
      edges: [edge("src", "tail")],
    };
    const seen: string[] = [];
    for await (const ev of executeGraph(g) as AsyncIterable<RunEvent>) {
      if (ev.type === "node") seen.push(`${ev.nodeId}:${ev.status}`);
    }
    // a frozen node is passed over without a word: no event, no change on the canvas
    expect(seen.filter((e) => e.startsWith("src:"))).toEqual([]);
    // what comes after a frozen node still runs
    expect(seen).toContain("tail:done");
  });

  it("still runs a frozen node when it is asked for by itself", async () => {
    const g: GraphDoc = {
      nodes: [{ ...node("src", "text", "go"), data: { kind: "text", text: "go", frozen: true } }],
      edges: [],
    };
    expect(await run(g, { only: "src" })).toEqual(["src"]);
  });
});
