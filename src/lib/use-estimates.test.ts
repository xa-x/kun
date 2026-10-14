import { describe, expect, it } from "vitest";
import { formatEstimate } from "./use-estimates";

describe("formatEstimate", () => {
  it("shows cents for a costly video model and minutes for a long wait", () => {
    expect(formatEstimate({ costUsd: 0.93411, durationMs: 282_751, samples: 3 })).toBe(
      "~$0.93 · ~5 min",
    );
  });

  it("keeps four decimals for a sub-cent text call and seconds for a short one", () => {
    expect(formatEstimate({ costUsd: 0.000297, durationMs: 5_300, samples: 9 })).toBe(
      "~$0.0003 · ~5s",
    );
  });

  it("leaves out the time when none was recorded", () => {
    expect(formatEstimate({ costUsd: 0.5, durationMs: 0, samples: 1 })).toBe("~$0.50");
  });
});

describe("formatEstimate with a translator", () => {
  it("words the time through it", () => {
    const t = (k: string, v?: Record<string, string | number>) => `${k}:${v?.n}`;
    expect(formatEstimate({ costUsd: 0.5, durationMs: 5_000, samples: 1 }, t as never)).toBe(
      "~$0.50 · ~editor.estimate.sec:5",
    );
  });
});
