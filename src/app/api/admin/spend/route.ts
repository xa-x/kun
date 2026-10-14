import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { runNodes, usageLedger } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { OPENROUTER_BASE_URL, envApiKey } from "@/lib/providers";

export const runtime = "nodejs";

/**
 * GET /api/admin/spend — does the ledger match what OpenRouter charged?
 *
 * OpenRouter reports the cost of text and video calls but not of image
 * generation, so a call can finish, cost real money and be recorded at $0.
 * This sets the key's own total beside the ledger's and lists the models whose
 * finished calls were all recorded free, so a price can be set for them.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!isPlatformAdmin(actor.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let providerUsd: number | null = null;
    const apiKey = envApiKey();
    if (apiKey) {
      const res = await fetch(`${OPENROUTER_BASE_URL}/key`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      if (res?.ok) {
        const j = (await res.json()) as { data?: { usage?: unknown } };
        if (typeof j.data?.usage === "number") providerUsd = j.data.usage;
      }
    }

    const [ledger] = await db
      .select({ micro: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)::float` })
      .from(usageLedger);
    const ledgerUsd = (ledger?.micro ?? 0) / 1e6;

    const unpriced = await db
      .select({
        model: runNodes.model,
        calls: sql<number>`count(*)::int`,
        freeCalls: sql<number>`count(*) filter (where ${runNodes.costUsd} = 0)::int`,
      })
      .from(runNodes)
      .where(
        and(
          eq(runNodes.status, "done"),
          isNotNull(runNodes.model),
          ne(runNodes.model, ""),
          gte(runNodes.createdAt, new Date(Date.now() - 60 * 86_400_000)),
        ),
      )
      .groupBy(runNodes.model);

    return NextResponse.json({
      providerUsd,
      ledgerUsd,
      gapUsd: providerUsd == null ? null : Math.max(0, providerUsd - ledgerUsd),
      // Models whose every finished call was recorded at $0.
      unpriced: unpriced
        .filter((r) => r.model && r.calls > 0 && r.freeCalls === r.calls)
        .map((r) => ({ model: r.model as string, calls: r.calls }))
        .sort((a, b) => b.calls - a.calls),
    });
  } catch (e) {
    return fail(e);
  }
}
