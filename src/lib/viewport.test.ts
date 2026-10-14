import { describe, expect, it } from "vitest";
import { READABLE_ZOOM, readableViewport } from "./viewport";

const screen = { width: 744, height: 860 };

describe("readableViewport", () => {
  it("fits a small graph and centres it", () => {
    const v = readableViewport({ x: 0, y: 0, width: 300, height: 200 }, screen);
    expect(v.zoom).toBe(1);
    expect(v.x).toBeCloseTo(744 / 2 - 150);
    expect(v.y).toBeCloseTo(860 / 2 - 100);
  });

  it("never shrinks a long pipeline below readable text", () => {
    const v = readableViewport({ x: 100, y: 0, width: 3000, height: 600 }, screen);
    expect(v.zoom).toBe(READABLE_ZOOM);
  });

  it("starts at the left edge of a long pipeline", () => {
    const v = readableViewport({ x: 100, y: 0, width: 3000, height: 600 }, screen);
    // the first node sits 32px from the left of the screen
    expect(100 * v.zoom + v.x).toBeCloseTo(32);
  });
});
