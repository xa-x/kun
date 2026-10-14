import { describe, expect, it } from "vitest";
import { planOf, PLANS, splitCharge } from "./billing";

describe("plans", () => {
  it("defaults unknown plans to free", () => {
    expect(planOf("nope").id).toBe("free");
    expect(planOf("pro").schedules).toBe(true);
    expect(PLANS.free.mcp).toBe(false);
    expect(PLANS.team.team).toBe(true);
  });
});

describe("splitCharge", () => {
  it("spends included credits before the balance", () => {
    expect(splitCharge(5, 10, 100)).toEqual({ fromIncluded: 5, fromBalance: 0 });
    expect(splitCharge(15, 10, 100)).toEqual({ fromIncluded: 10, fromBalance: 5 });
  });

  it("draws only on the balance once included credits are gone", () => {
    expect(splitCharge(7, 0, 100)).toEqual({ fromIncluded: 0, fromBalance: 7 });
    expect(splitCharge(7, -3, 100)).toEqual({ fromIncluded: 0, fromBalance: 7 });
  });

  it("never takes the balance below zero", () => {
    expect(splitCharge(30, 10, 5)).toEqual({ fromIncluded: 10, fromBalance: 5 });
    expect(splitCharge(30, 0, 0)).toEqual({ fromIncluded: 0, fromBalance: 0 });
  });
});
