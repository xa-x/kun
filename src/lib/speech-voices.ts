/**
 * Speech models that refuse to run without a voice ("An explicit voice is
 * required…"). OpenRouter lists each model's voices in its catalog; the first
 * one is a sound default when the node left the voice on Auto.
 */
const TTL_MS = 10 * 60_000;
let cache: {
  at: number;
  voices: Map<string, string[]>;
  /** USD per input character, from the catalog. */
  prices: Map<string, number>;
} | null = null;

async function speechCatalog(baseUrl: string) {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const res = await fetch(
      `${baseUrl.replace(/\/$/, "")}/models?output_modalities=speech`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return undefined;
    const body = (await res.json()) as {
      data?: {
        id?: unknown;
        supported_voices?: unknown;
        pricing?: { prompt?: unknown };
      }[];
    };
    const voices = new Map<string, string[]>();
    const prices = new Map<string, number>();
    for (const m of body.data ?? []) {
      if (typeof m.id !== "string") continue;
      if (Array.isArray(m.supported_voices))
        voices.set(
          m.id,
          m.supported_voices.filter((v): v is string => typeof v === "string" && !!v),
        );
      const price = Number(m.pricing?.prompt);
      if (Number.isFinite(price) && price > 0) prices.set(m.id, price);
    }
    cache = { at: Date.now(), voices, prices };
  }
  return cache;
}

export async function firstVoiceFor(
  baseUrl: string,
  model: string,
): Promise<string | undefined> {
  return (await speechCatalog(baseUrl))?.voices.get(model)?.[0];
}

/**
 * What a speech call cost, from the catalog's rate per input character.
 * OpenRouter bills speech this way but sends no cost back with the audio:
 * 416 characters on MiniMax Speech 2.8 Turbo ($0.00006 each) was billed
 * $0.025. Undefined when the model has no listed rate.
 */
export async function speechCostUsd(
  baseUrl: string,
  model: string,
  chars: number,
): Promise<number | undefined> {
  const price = (await speechCatalog(baseUrl))?.prices.get(model);
  return price ? price * chars : undefined;
}

/** The provider's way of saying the voice was required. */
export const needsVoice = (status: number, message: string) =>
  status === 400 && /voice/i.test(message) && /requir/i.test(message);
