import { describe, expect, it } from "vitest";
import { runResult } from "./result";

const node = (id: string, kind: string, data: Record<string, unknown> = {}) => ({
  id,
  type: "flow",
  position: { x: 0, y: 0 },
  data: { kind, ...data },
});
const edge = (source: string, target: string) => ({
  id: `${source}-${target}`,
  source,
  sourceHandle: "out",
  target,
  targetHandle: "in",
});
const done = (nodeId: string, output: unknown) => ({ nodeId, status: "done", output });
const text = (t: string) => [{ type: "text", text: t }];

// text -> summary -> (voice, cover); the summary feeds two nodes, so it is not last
const graph = {
  nodes: [
    node("t", "text"),
    node("sum", "llm", { label: "Summary" }),
    node("voice", "tts"),
    node("cover", "image.gen"),
  ],
  edges: [edge("t", "sum"), edge("sum", "voice"), edge("sum", "cover")],
};

describe("runResult", () => {
  it("is the last AI nodes when nothing is pinned", () => {
    const rows = [
      done("sum", text("hello")),
      done("voice", [{ type: "audio", url: "/a" }]),
      done("cover", [{ type: "image", url: "/i" }]),
    ];
    expect(runResult(graph, rows).map((r) => [r.nodeId, r.label])).toEqual([
      ["voice", "AI Speech"],
      ["cover", "AI Image"],
    ]);
  });

  it("is only the pinned nodes once any are pinned", () => {
    const pinned = {
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === "sum" ? { ...n, data: { ...n.data, pinned: true } } : n)),
    };
    const rows = [done("sum", text("hello")), done("cover", [{ type: "image", url: "/i" }])];
    expect(runResult(pinned, rows)).toEqual([
      { nodeId: "sum", label: "Summary", outputs: [{ type: "text", text: "hello" }] },
    ]);
  });

  it("keeps the meaning of an Output node in projects that still have one", () => {
    const legacy = {
      nodes: [...graph.nodes, node("o", "out.text", { label: "Final" })],
      edges: [...graph.edges, edge("sum", "o")],
    };
    const rows = [done("sum", text("hello")), done("o", text("hello"))];
    expect(runResult(legacy, rows).map((r) => r.nodeId)).toEqual(["o"]);
  });

  it("skips nodes that failed or made nothing, and uses a frozen node's saved result", () => {
    const frozen = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === "cover"
          ? { ...n, data: { ...n.data, frozen: true, outputs: [{ type: "image", url: "/old" }] } }
          : n,
      ),
    };
    const rows = [{ nodeId: "voice", status: "error", output: null }];
    expect(runResult(frozen as never, rows)).toEqual([
      { nodeId: "cover", label: "AI Image", outputs: [{ type: "image", url: "/old" }] },
    ]);
  });

  it("is empty without a snapshot", () => {
    expect(runResult(null, [])).toEqual([]);
  });
});
