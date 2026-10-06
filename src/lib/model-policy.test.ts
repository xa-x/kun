import { describe, expect, it, vi } from "vitest";
import {
  applyMargin,
  billableCostUsd,
} from "./model-policy";

// policyMap() closes over the module-local cache and hits drizzle directly,
// so the seam that works is faking `db.select().from(modelPolicy)` itself.
// DB rows store pricePerUsd in micro-USD; the fixtures below use USD.
const rows = vi.hoisted(() => [
  { model: "a/cheap", enabled: true, pricePerUsd: null, marginPct: 0 },
  { model: "a/marked", enabled: true, pricePerUsd: null, marginPct: 20 },
  { model: "a/priced", enabled: true, pricePerUsd: 0.05, marginPct: 0 },
  { model: "a/both", enabled: true, pricePerUsd: 0.1, marginPct: 50 },
]);

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () =>
        Promise.resolve(
          rows.map((r) => ({
            ...r,
            pricePerUsd: r.pricePerUsd == null ? null : Math.round(r.pricePerUsd * 1e6),
          })),
        ),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  modelPolicy: {},
}));

describe("billableCostUsd", () => {
  it("passes through when no policy exists", async () => {
    expect(await billableCostUsd("unknown/x", 0.01)).toBe(0.01);
  });

  it("passes through provider cost with zero margin", async () => {
    expect(await billableCostUsd("a/cheap", 0.01)).toBe(0.01);
  });

  it("applies the margin percentage", async () => {
    expect(await billableCostUsd("a/marked", 0.01)).toBeCloseTo(0.012);
  });

  it("price override replaces the cost basis", async () => {
    expect(await billableCostUsd("a/priced", 0.9)).toBe(0.05);
  });

  it("override and margin compose", async () => {
    expect(await billableCostUsd("a/both", 0.9)).toBeCloseTo(0.15);
  });

  it("returns undefined cost untouched", async () => {
    expect(await billableCostUsd("a/marked", undefined)).toBeUndefined();
  });
});

describe("applyMargin", () => {
  it("rewrites usage cost and keeps the rest", async () => {
    const out = await applyMargin("a/marked", {
      costUsd: 0.02,
      tokensIn: 10,
      tokensOut: 5,
      model: "a/marked",
    });
    expect(out?.costUsd).toBeCloseTo(0.024);
    expect(out?.tokensIn).toBe(10);
    expect(out?.tokensOut).toBe(5);
  });

  it("returns undefined usage untouched", async () => {
    expect(await applyMargin("a/marked", undefined)).toBeUndefined();
  });
});
