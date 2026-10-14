import { afterEach, describe, expect, it, vi } from "vitest";
import { needsVoice } from "./speech-voices";

describe("needsVoice", () => {
  it("recognises the provider asking for a voice", () => {
    expect(needsVoice(400, "An explicit voice is required for this TTS provider.")).toBe(true);
    expect(needsVoice(400, "Model does not exist")).toBe(false);
    expect(needsVoice(500, "voice is required")).toBe(false);
  });
});

describe("speech catalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("prices a call from the per-character rate and picks the first voice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            {
              id: "minimax/speech-2.8-turbo",
              supported_voices: ["English_expressive_narrator", "other"],
              pricing: { prompt: "0.00006", completion: "0" },
            },
            { id: "free/speech", supported_voices: ["a"], pricing: { prompt: "0" } },
          ],
        }),
      ),
    );
    const { speechCostUsd, firstVoiceFor } = await import("./speech-voices");
    // 416 characters was billed $0.025 on OpenRouter's dashboard
    expect(await speechCostUsd("https://x/api/v1", "minimax/speech-2.8-turbo", 416)).toBeCloseTo(0.02496, 5);
    expect(await speechCostUsd("https://x/api/v1", "free/speech", 100)).toBeUndefined();
    expect(await speechCostUsd("https://x/api/v1", "unknown/model", 100)).toBeUndefined();
    expect(await firstVoiceFor("https://x/api/v1", "minimax/speech-2.8-turbo")).toBe(
      "English_expressive_narrator",
    );
  });
});
