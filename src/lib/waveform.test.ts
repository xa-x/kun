import { describe, expect, it } from "vitest";
import { peaksOf, standInPeaks } from "./waveform";

describe("peaksOf", () => {
  it("scales the loudest slice to 1 and keeps quiet ones visible", () => {
    const s = new Float32Array(1000);
    s[100] = 0.2; // slice 1 of 10
    s[550] = 0.8; // slice 5
    const p = peaksOf(s, 10);
    expect(p).toHaveLength(10);
    expect(p[5]).toBe(1);
    expect(p[1]).toBeCloseTo(0.25);
    expect(p[0]).toBe(0.06); // silence still draws a sliver
  });

  it("handles empty audio", () => {
    expect(peaksOf(new Float32Array(0), 10)).toEqual([]);
  });
});

describe("standInPeaks", () => {
  it("is stable per clip and differs between clips", () => {
    expect(standInPeaks("a", 40)).toEqual(standInPeaks("a", 40));
    expect(standInPeaks("a", 40)).not.toEqual(standInPeaks("b", 40));
  });
  it("stays within the drawable range", () => {
    for (const v of standInPeaks("clip", 64)) {
      expect(v).toBeGreaterThanOrEqual(0.1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
