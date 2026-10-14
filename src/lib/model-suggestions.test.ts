import { describe, expect, it } from "vitest";
import { buildSuggestions } from "./model-suggestions";
import type { ModelInfo } from "./models";

const m = (id: string, created = 0): ModelInfo => ({
  id,
  label: id,
  outputs: ["text"],
  created,
});

const live = [
  m("openai/old", 1),
  m("openai/new", 9),
  m("google/mid", 5),
  m("anthropic/fresh", 8),
  m("anthropic/fresh:batch", 9),
  m("deepseek/thing-preview", 10),
  m("nobody/obscure", 99),
];

describe("buildSuggestions", () => {
  it("puts pins first, then usage, then the newest per vendor", () => {
    const out = buildSuggestions({
      live,
      kind: "chat",
      pins: new Map([["google/mid", 1]]),
      usage: new Map([["openai/old", 40]]),
    });
    expect(out.map((s) => [s.id, s.source])).toEqual([
      ["google/mid", "pinned"],
      ["openai/old", "popular"],
      ["anthropic/fresh", "new"],
    ]);
  });

  it("never suggests a model the live catalog lacks", () => {
    const out = buildSuggestions({
      live,
      kind: "chat",
      pins: new Map([["gone/model", 0]]),
      usage: new Map([["gone/other", 99]]),
    });
    expect(out.some((s) => s.id.startsWith("gone/"))).toBe(false);
  });

  it("skips variants and previews unless pinned", () => {
    const fresh = buildSuggestions({ live, kind: "chat", pins: new Map(), usage: new Map() });
    expect(fresh.map((s) => s.id)).toEqual(["openai/new", "anthropic/fresh", "google/mid"]);
    expect(fresh.some((s) => s.id.startsWith("nobody/"))).toBe(false);
    const pinned = buildSuggestions({
      live,
      kind: "chat",
      pins: new Map([["deepseek/thing-preview", 0]]),
      usage: new Map(),
    });
    expect(pinned[0].id).toBe("deepseek/thing-preview");
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 24 }, (_, i) => m(`${["openai","google","anthropic","deepseek","x-ai","qwen"][i % 6]}/x${i}`, i));
    expect(
      buildSuggestions({ live: many, kind: "chat", pins: new Map(), usage: new Map(), limit: 4 }),
    ).toHaveLength(4);
  });

  it("fills speech from the curated list, not the newest models", () => {
    const speech = (id: string, created: number): ModelInfo => ({
      id,
      label: id,
      outputs: ["audio"],
      created,
    });
    const out = buildSuggestions({
      live: [speech("openai/brand-new-tts", 99), speech("google/known-good", 1)],
      kind: "audio",
      pins: new Map(),
      usage: new Map(),
      curated: ["google/known-good", "gone/model"],
    });
    expect(out.map((s) => [s.id, s.source])).toEqual([["google/known-good", "curated"]]);
  });

  it("puts known-good image models ahead of the newest ones", () => {
    const img = (id: string, created: number): ModelInfo => ({ id, label: id, outputs: ["image"], created });
    const out = buildSuggestions({
      live: [img("google/brand-new-image", 99), img("bytedance-seed/proven", 1)],
      kind: "image",
      pins: new Map(),
      usage: new Map(),
      curated: ["bytedance-seed/proven"],
    });
    expect(out.map((s) => [s.id, s.source])).toEqual([
      ["bytedance-seed/proven", "curated"],
      ["google/brand-new-image", "new"],
    ]);
  });
});
