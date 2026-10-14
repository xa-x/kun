import { describe, expect, it } from "vitest";
import { frameAround, frameAt, GROUP_PAD, GROUP_TOP, membersOf, moveMembers, refitGroups, type GNode } from "./groups";

const sizeOf = () => ({ w: 200, h: 100 });
const node = (id: string, x: number, y: number, extra: Partial<GNode["data"]> = {}): GNode => ({
  id,
  position: { x, y },
  data: { kind: "llm", ...extra },
});

describe("frameAround", () => {
  it("holds its nodes with padding, and room on top for the name", () => {
    const f = frameAround([node("a", 100, 100), node("b", 400, 200)], sizeOf);
    expect(f.position).toEqual({ x: 100 - GROUP_PAD, y: 100 - GROUP_PAD - GROUP_TOP });
    expect(f.w).toBe(500 + GROUP_PAD * 2); // 100..600
    expect(f.h).toBe(200 + GROUP_PAD * 2 + GROUP_TOP); // 100..300
  });
});

describe("refitGroups", () => {
  it("follows the members and leaves an empty frame alone", () => {
    const frame = node("g", 0, 0, { kind: "group", w: 10, h: 10 });
    const empty = node("g2", 900, 900, { kind: "group", w: 50, h: 60 });
    const out = refitGroups([frame, empty, node("a", 300, 300, { group: "g" })], sizeOf);
    expect(out[0].position).toEqual({ x: 300 - GROUP_PAD, y: 300 - GROUP_PAD - GROUP_TOP });
    expect(out[0].data.w).toBe(200 + GROUP_PAD * 2);
    expect(out[1]).toBe(empty);
  });
});

describe("frameAt", () => {
  const big = node("big", 0, 0, { kind: "group", w: 1000, h: 600 });
  const small = node("small", 100, 100, { kind: "group", w: 400, h: 300 });

  it("picks the smallest frame holding the node's centre", () => {
    const inBoth = node("n", 150, 150);
    expect(frameAt(inBoth, [big, small, inBoth], sizeOf)).toBe("small");
    const inBigOnly = node("m", 700, 300);
    expect(frameAt(inBigOnly, [big, small, inBigOnly], sizeOf)).toBe("big");
  });

  it("is undefined outside every frame", () => {
    const out = node("o", 2000, 2000);
    expect(frameAt(out, [big, small, out], sizeOf)).toBeUndefined();
  });
});

describe("moveMembers / membersOf", () => {
  it("moves a frame's nodes but not ones already travelling with it", () => {
    const nodes = [node("a", 0, 0, { group: "g" }), node("b", 10, 10, { group: "g" }), node("c", 5, 5)];
    const moved = moveMembers(nodes, "g", 50, -5, new Set(["b"]));
    expect(moved[0].position).toEqual({ x: 50, y: -5 });
    expect(moved[1].position).toEqual({ x: 10, y: 10 });
    expect(moved[2].position).toEqual({ x: 5, y: 5 });
    expect(membersOf(nodes, "g").map((n) => n.id)).toEqual(["a", "b"]);
  });
});
