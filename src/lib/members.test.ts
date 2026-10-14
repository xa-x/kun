import { describe, expect, it } from "vitest";
import { canManageMember, isAssignable } from "./members";

describe("members", () => {
  it("never lets the owner be changed or removed", () => {
    expect(canManageMember("admin", "owner", false)).toBe(false);
    expect(canManageMember("owner", "owner", true)).toBe(false);
  });
  it("lets admins manage others, and anyone leave", () => {
    expect(canManageMember("admin", "editor", false)).toBe(true);
    expect(canManageMember("editor", "viewer", false)).toBe(false);
    expect(canManageMember("viewer", "viewer", true)).toBe(true);
  });
  it("hands out only the lower three roles", () => {
    expect(isAssignable("editor")).toBe(true);
    expect(isAssignable("owner")).toBe(false);
    expect(isAssignable("root")).toBe(false);
  });
});
