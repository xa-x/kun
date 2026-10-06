/**
 * Provider registry — OpenRouter only. Platform keys live in `.env`
 * (OPENROUTER_API_KEY); users never bring their own. Any legacy provider
 * tag on a node (e.g. "pyok") resolves through OpenRouter, because model
 * ids are vendor-prefixed and route correctly on its catalog.
 */

import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";

/** Older ids (pyk/pyok gateways) collapse onto OpenRouter. */
const PROVIDER_ALIASES: Record<string, string> = {
  pyk: "openrouter",
  pyok: "openrouter",
};

export const canonicalProviderId = (id: string) =>
  PROVIDER_ALIASES[id] ?? id;

export const DEFAULT_PROVIDER = "openrouter";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function envApiKey(): string {
  return process.env.OPENROUTER_API_KEY ?? "";
}

export interface ResolvedProvider {
  id: "openrouter";
  gw: OpenRouterProvider;
  apiKey: string;
  baseUrl: string;
}

let cached: ResolvedProvider | null = null;

/**
 * The one provider: OpenRouter, authenticated with the server's .env key.
 * Throws with an operator-facing message when the key is missing so a run
 * fails loudly instead of 401-ing deep inside a node.
 */
export function resolveProvider(): ResolvedProvider {
  if (cached) return cached;
  const apiKey = envApiKey();
  if (!apiKey)
    throw new Error(
      "OpenRouter is not configured — set OPENROUTER_API_KEY in the server .env.",
    );
  cached = {
    id: "openrouter",
    gw: createOpenRouter({ apiKey, baseURL: OPENROUTER_BASE_URL }),
    apiKey,
    baseUrl: OPENROUTER_BASE_URL,
  };
  return cached;
}

/** Which providers have usable credentials (for /api/config badges). */
export function envProviderFlags(): Record<string, boolean> {
  return { openrouter: !!envApiKey() };
}

/** Legacy shim: every provider id resolves to the same OpenRouter creds. */
export function providerCreds() {
  return {
    id: "openrouter" as const,
    baseUrl: OPENROUTER_BASE_URL,
    apiKey: envApiKey(),
  };
}
