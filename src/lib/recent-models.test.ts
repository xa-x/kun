import { describe, expect, it } from "vitest";
import { mergeRecent, pickRecentDefault } from "./recent-models";
import type { ModelInfo } from "./models";

const model = (id: string, outputs: ModelInfo["outputs"] = ["text"]) => ({
  id,
  label: id,
  outputs,
});

describe("mergeRecent", () => {
  it("moves a repeat use to the front without duplicating", () => {
    const list = mergeRecent(
      [{ id: "a/x" }, { id: "b/y" }],
      { id: "a/x" },
    );
    expect(list.map((m) => m.id)).toEqual(["a/x", "b/y"]);
  });

  it("keeps the old label and provider when a run omits them", () => {
    const list = mergeRecent(
      [{ id: "a/x", provider: "pyok", label: "X" }],
      { id: "a/x" },
    );
    expect(list[0]).toEqual({ id: "a/x", provider: "pyok", label: "X" });
  });

  it("caps the list at the newest six, dropping the oldest", () => {
    let list = ["1", "2", "3", "4", "5", "6"].map((n) => ({ id: `a/${n}` }));
    list = mergeRecent(list, { id: "a/7" });
    expect(list).toHaveLength(6);
    expect(list[0].id).toBe("a/7");
    expect(list.some((m) => m.id === "a/6")).toBe(false);
  });
});

describe("pickRecentDefault", () => {
  const orList = [model("a/live"), model("a/sugg")];

  it("prefers the most recent model the provider still lists", () => {
    const hit = pickRecentDefault(
      [{ id: "a/retired" }, { id: "a/live" }],
      [{ id: "a/sugg" }],
      { openrouter: orList },
      undefined,
      "chat",
    );
    expect(hit).toEqual({ model: "a/live", provider: undefined });
  });

  it("falls through retired recents to the curated suggestions", () => {
    const hit = pickRecentDefault(
      [{ id: "a/retired" }],
      [{ id: "a/sugg" }],
      { openrouter: [...orList, model("a/sugg")] },
      undefined,
      "chat",
    );
    expect(hit.model).toBe("a/sugg");
  });

  it("trusts recents when no live list could be fetched", () => {
    const hit = pickRecentDefault(
      [{ id: "a/whatever" }],
      [{ id: "a/sugg" }],
      { openrouter: orList },
      { openrouter: "HTTP 429" },
      "chat",
    );
    expect(hit.model).toBe("a/whatever");
  });

  it("keeps a gateway recent only while its gateway lists it", () => {
    const gw = { pyok: [model("g/one", ["image"])] };
    const base = {
      suggested: [{ id: "a/sugg" }],
      errors: undefined,
      kind: "image" as const,
    };
    expect(
      pickRecentDefault([{ id: "g/one", provider: "pyok" }], base.suggested, {
        ...gw,
        openrouter: [],
      }, base.errors, "image"),
    ).toEqual({ model: "g/one", provider: "pyok" });
    expect(
      pickRecentDefault([{ id: "g/gone", provider: "pyok" }], base.suggested, {
        ...gw,
        openrouter: [],
      }, base.errors, "image"),
    ).toEqual({ model: "a/sugg", provider: undefined });
  });

  it("skips a gateway recent whose provider is not configured", () => {
    expect(
      pickRecentDefault(
        [{ id: "g/one", provider: "pyok" }],
        [{ id: "a/sugg" }],
        { openrouter: [model("a/sugg")] },
        undefined,
        "chat",
      ).model,
    ).toBe("a/sugg");
  });
});
