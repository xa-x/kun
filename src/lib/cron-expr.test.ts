import { describe, expect, it } from "vitest";
import { describeCron, nextCron, previewCron } from "./cron-expr";
import { MESSAGES } from "./i18n/messages";
import { translate, translatePlural } from "./i18n/translate";

const at = new Date("2026-10-14T10:30:00Z"); // a Wednesday

describe("nextCron", () => {
  it("finds the next daily slot", () => {
    expect(nextCron("0 9 * * *", at).toISOString()).toBe("2026-10-15T09:00:00.000Z");
  });
  it("skips the weekend for weekdays", () => {
    const fri = new Date("2026-10-16T10:00:00Z");
    expect(nextCron("0 9 * * 1-5", fri).toISOString()).toBe("2026-10-19T09:00:00.000Z");
  });
  it("handles steps", () => {
    expect(nextCron("*/15 * * * *", at).toISOString()).toBe("2026-10-14T10:45:00.000Z");
  });
  it("rejects anything but five fields", () => {
    expect(() => nextCron("0 9 * *", at)).toThrow(/5 fields/);
  });
});

describe("describeCron / previewCron", () => {
  it("puts common schedules in words", () => {
    expect(describeCron("0 9 * * 1-5")).toBe("Weekdays at 09:00");
    expect(describeCron("*/5 * * * *")).toBe("Every 5 minutes");
    expect(describeCron("30 14 * * *")).toBe("Every day at 14:30");
    expect(describeCron("5 4 1 * *")).toBe("5 4 1 * *");
  });
  it("previews without throwing", () => {
    expect(previewCron("0 9 * * *", at)).toEqual({ next: new Date("2026-10-15T09:00:00.000Z") });
    expect(previewCron("nope", at)).toEqual({ error: expect.stringMatching(/5 fields/) });
  });
});

describe("describeCron in Arabic", () => {
  const m = MESSAGES.ar;
  const words = {
    t: (k: Parameters<typeof translate>[2], v?: Parameters<typeof translate>[3]) => translate(m, MESSAGES.en, k, v),
    tn: (b: string, n: number) => translatePlural("ar", m, MESSAGES.en, b, n),
  };
  it("words presets, steps and daily times", () => {
    expect(describeCron("0 * * * *", words as never)).toBe("كل ساعة");
    expect(describeCron("*/5 * * * *", words as never)).toBe("كل 5 دقائق");
    expect(describeCron("30 14 * * *", words as never)).toBe("كل يوم عند 14:30");
  });
});
