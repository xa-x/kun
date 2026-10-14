import { describe, expect, it } from "vitest";
import { allowance, billedSeats, fits, fmtMb, planOf, PLANS, splitCharge, workspaceCap } from "./billing";

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

describe("plan limits", () => {
  it("treats null as no limit and counts what is being added", () => {
    expect(fits(9, 1, 10)).toBe(true);
    expect(fits(10, 1, 10)).toBe(false);
    expect(fits(1e12, 1e12, null)).toBe(true);
  });

  it("lets a person own as many workspaces as their best plan allows", () => {
    expect(workspaceCap([])).toBe(PLANS.free.workspaces);
    expect(workspaceCap(["free", "free"])).toBe(PLANS.free.workspaces);
    expect(workspaceCap(["free", "pro"])).toBe(PLANS.pro.workspaces);
    expect(workspaceCap(["team"])).toBe(PLANS.team.workspaces);
  });

  it("gets bigger with each plan", () => {
    expect(PLANS.pro.storageMb).toBeGreaterThan(PLANS.free.storageMb);
    expect(PLANS.team.storageMb).toBeGreaterThan(PLANS.pro.storageMb);
    expect(PLANS.team.members).toBeGreaterThan(PLANS.pro.members);
    expect(PLANS.team.projects).toBeNull();
    expect(fmtMb(500)).toBe("500 MB");
    expect(fmtMb(20480)).toBe("20 GB");
  });
});

describe("Team pricing", () => {
  it("costs more than Pro for one person, because it bills at least three seats", () => {
    expect(PLANS.team.seatUsd).toBe(39);
    expect(billedSeats(PLANS.team, 1)).toBe(3);
    expect(billedSeats(PLANS.team, 7)).toBe(7);
    const soloTeam = PLANS.team.seatUsd! * billedSeats(PLANS.team, 1);
    expect(soloTeam).toBeGreaterThan(PLANS.pro.monthlyUsd);
  });

  it("scales the monthly allowance with the seats billed", () => {
    expect(allowance(PLANS.team, 1)).toEqual({ runs: 15_000, creditsUsd: 60 });
    expect(allowance(PLANS.team, 10)).toEqual({ runs: 50_000, creditsUsd: 200 });
    expect(allowance(PLANS.pro, 1)).toEqual({ runs: 2000, creditsUsd: 15 });
  });

  it("never gives a Team seat less than Pro gives a person", () => {
    expect(PLANS.team.monthlyRuns).toBeGreaterThan(PLANS.pro.monthlyRuns);
    expect(PLANS.team.monthlyCreditsUsd).toBeGreaterThan(PLANS.pro.monthlyCreditsUsd);
  });
});
