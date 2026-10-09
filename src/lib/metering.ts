import { applyMargin } from "./model-policy";
import { usageFromUnknown } from "./runners";
import { recordUsage } from "./runs/enqueue";

/**
 * Bill a model call made outside a run (assistant, skill generator) to the
 * org's ledger, so it counts against monthly credits like any node does.
 * Best effort: a provider that omits usage must not fail the request.
 */
export async function meterModelCall(
  orgId: string,
  kind: "assistant" | "skill",
  model: string,
  raw: { usage?: unknown; providerMetadata?: unknown },
) {
  try {
    const usage = await applyMargin(model, usageFromUnknown(raw, { model }));
    const tokens = (usage?.tokensIn ?? 0) + (usage?.tokensOut ?? 0);
    const amountUsd = Math.round((usage?.costUsd ?? 0) * 1e6);
    if (!amountUsd && !tokens) return;
    await recordUsage({ orgId, kind, amountUsd, tokens, model, provider: "openrouter" });
  } catch (e) {
    console.error("[metering] could not record usage:", e);
  }
}
