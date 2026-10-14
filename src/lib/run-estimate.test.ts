import { describe, expect, it } from "vitest";
import { estimateRun, formatRunEstimate, runTargets } from "./run-estimate";

const node = (id: string, kind: string) => ({ id, data: { kind } });
const nodes = [
  node("t", "text"),
  node("llm", "llm"),
  node("img", "image.gen"),
  node("tts", "tts"),
  node("vid", "video.gen"),
  node("out", "out.text"),
];
const edges = [
  { source: "t", target: "llm" },
  { source: "llm", target: "img" },
  { source: "llm", target: "tts" },
  { source: "img", target: "vid" },
  { source: "vid", target: "out" },
  { source: "tts", target: "out" },
];
const table: Record<string, { costUsd: number; durationMs: number }> = {
  llm: { costUsd: 0.0003, durationMs: 5_000 },
  img: { costUsd: 0.06, durationMs: 30_000 },
  tts: { costUsd: 0.01, durationMs: 8_000 },
  vid: { costUsd: 0.93, durationMs: 280_000 },
};
const estimateOf = (id: string) => table[id] ?? null;

describe("runTargets", () => {
  it("'only' is just that node, 'from' is that node and what follows", () => {
    expect(runTargets(nodes, edges, { only: "llm" })).toEqual(["llm"]);
    expect(runTargets(nodes, edges, { from: "img" }).sort()).toEqual(["img", "out", "vid"]);
  });

  it("a full run leaves out generation nobody reads", () => {
    const dead = [...nodes, node("lonely", "image.gen")];
    expect(runTargets(dead, edges)).not.toContain("lonely");
  });
});

describe("estimateRun", () => {
  it("sums cost and takes the longest chain for time", () => {
    const e = estimateRun({ nodes, edges, estimateOf });
    expect(e.costUsd).toBeCloseTo(1.0003, 4);
    // text -> llm -> img -> vid is the long way: 5 + 30 + 280 s, tts runs beside it
    expect(e.durationMs).toBe(315_000);
    expect(e.aiNodes).toBe(4);
    expect(e.unpriced).toBe(0);
  });

  it("running one node prices just that node", () => {
    const e = estimateRun({ nodes, edges, scope: { only: "vid" }, estimateOf });
    expect(e.costUsd).toBeCloseTo(0.93);
    expect(e.durationMs).toBe(280_000);
  });

  it("counts nodes without history instead of guessing a price", () => {
    const e = estimateRun({ nodes, edges, estimateOf: (id) => (id === "vid" ? null : estimateOf(id)) });
    expect(e.unpriced).toBe(1);
    expect(formatRunEstimate(e)).toMatch(/\+ 1 unpriced$/);
  });

  it("has nothing to say when no step has history", () => {
    const e = estimateRun({ nodes, edges, estimateOf: () => null });
    expect(formatRunEstimate(e)).toBeNull();
  });
});

describe("without an Output node", () => {
  const plain = [node("t", "text"), node("img", "image.gen"), node("vid", "video.gen")];
  const wires = [
    { source: "t", target: "img" },
    { source: "img", target: "vid" },
  ];

  it("a full run covers every node, even the last ones", () => {
    expect(runTargets(plain, wires).sort()).toEqual(["img", "t", "vid"]);
  });

  it("a frozen node costs nothing and takes no time", () => {
    const frozen = plain.map((n) => (n.id === "vid" ? { ...n, data: { ...n.data, frozen: true } } : n));
    const e = estimateRun({ nodes: frozen, edges: wires, estimateOf });
    expect(e.costUsd).toBeCloseTo(0.06);
    expect(e.aiNodes).toBe(1);
  });

  it("running a frozen node by itself prices it", () => {
    const frozen = plain.map((n) => (n.id === "vid" ? { ...n, data: { ...n.data, frozen: true } } : n));
    const e = estimateRun({ nodes: frozen, edges: wires, scope: { only: "vid" }, estimateOf });
    expect(e.costUsd).toBeCloseTo(0.93);
  });
});
