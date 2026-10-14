import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM, parsePlatform, patchPlatform } from "./platform";

describe("platform settings", () => {
  it("falls back to defaults for junk", () => {
    expect(parsePlatform(null)).toEqual(DEFAULT_PLATFORM);
    expect(parsePlatform({ maintenance: { on: "yes" } }).maintenance.on).toBe(false);
  });
  it("shows an announcement only when it has text", () => {
    expect(parsePlatform({ announcement: { on: true, text: "  " } }).announcement.on).toBe(false);
    const a = parsePlatform({ announcement: { on: true, text: " Downtime at 9 ", level: "warn" } }).announcement;
    expect(a).toEqual({ on: true, text: "Downtime at 9", level: "warn" });
  });
  it("applies only valid fields of a patch", () => {
    const next = patchPlatform(DEFAULT_PLATFORM, { signupOpen: true, evil: 1, maintenance: { on: true } });
    expect(next.signupOpen).toBe(true);
    expect(next.maintenance.on).toBe(true);
    expect(next.maintenance.message).toBe(DEFAULT_PLATFORM.maintenance.message);
  });
});
