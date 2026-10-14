import { describe, expect, it } from "vitest";

import { aspectNumber } from "./media-params";

describe("aspectNumber", () => {
  it("reads ratios and sizes", () => {
    expect(aspectNumber("16:9")).toBeCloseTo(16 / 9);
    expect(aspectNumber("1024x1024")).toBe(1);
    expect(aspectNumber("1080×1920")).toBeCloseTo(9 / 16);
  });
  it("ignores anything else", () => {
    expect(aspectNumber(undefined)).toBeUndefined();
    expect(aspectNumber("auto")).toBeUndefined();
    expect(aspectNumber("0:5")).toBeUndefined();
  });
});
