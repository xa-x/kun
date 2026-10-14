import { describe, expect, it } from "vitest";
import { cleanWorkspaceName, WORKSPACE_NAME_MAX } from "./workspaces";

describe("cleanWorkspaceName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanWorkspaceName("  Studio   North ")).toBe("Studio North");
  });
  it("rejects empty and one-letter names", () => {
    expect(cleanWorkspaceName("   ")).toBeNull();
    expect(cleanWorkspaceName("a")).toBeNull();
    expect(cleanWorkspaceName(42)).toBeNull();
  });
  it("caps the length", () => {
    expect(cleanWorkspaceName("x".repeat(100))).toHaveLength(WORKSPACE_NAME_MAX);
  });
});
