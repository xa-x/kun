import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, patchSettings, shareExpiry, workspaceSettings } from "./workspace-settings";

describe("workspace settings", () => {
  it("falls back to defaults for missing or junk values", () => {
    expect(workspaceSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(workspaceSettings({ allowPublicShares: "no", shareLinkDays: 5 })).toEqual(DEFAULT_SETTINGS);
  });

  it("applies only valid fields from a patch", () => {
    const next = patchSettings(DEFAULT_SETTINGS, { allowPublicShares: false, shareLinkDays: 30, evil: true });
    expect(next).toEqual({ allowPublicShares: false, allowCommunityPublish: true, shareLinkDays: 30 });
    expect(patchSettings(next, { shareLinkDays: null }).shareLinkDays).toBeNull();
    expect(patchSettings(next, { shareLinkDays: 12 }).shareLinkDays).toBeNull();
  });

  it("expires new links by the workspace rule", () => {
    const now = Date.parse("2026-10-15T00:00:00Z");
    expect(shareExpiry(DEFAULT_SETTINGS, now)).toBeNull();
    expect(shareExpiry({ ...DEFAULT_SETTINGS, shareLinkDays: 7 }, now)?.toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });
});
