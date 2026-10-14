import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, graphs, schedules, webhookEndpoints } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { planOf } from "@/lib/billing";
import { hasUnpublishedChanges, type PublishedDoc } from "@/lib/publish";
import { canAdmin, canEdit } from "@/lib/tenant";
import type { GraphDoc } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/graphs/[id]/automation — everything the Automate panel shows in one
 * call: the live version, schedules, webhooks, API keys and what the plan
 * allows.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    const [g] = await db.select().from(graphs).where(eq(graphs.id, id)).limit(1);
    if (!g || g.orgId !== actor.org.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const editor = canEdit(actor.membership.role);
    const [scheds, hooks, keys] = await Promise.all([
      db.select().from(schedules).where(eq(schedules.graphId, id)),
      db.select().from(webhookEndpoints).where(eq(webhookEndpoints.graphId, id)),
      db.select().from(apiKeys).where(eq(apiKeys.orgId, actor.org.id)),
    ]);
    const published = (g.publishedGraph ?? null) as PublishedDoc | null;
    const plan = planOf(actor.org.plan);
    return NextResponse.json({
      graphId: id,
      canEdit: editor,
      canAdmin: canAdmin(actor.membership.role),
      plan: {
        label: plan.label,
        schedules: plan.schedules,
        webhooks: plan.webhooks,
        mcp: plan.mcp,
      },
      live: {
        publishedAt: published?.publishedAt ?? null,
        published: !!published,
        stale: hasUnpublishedChanges(g.graph as GraphDoc, published),
      },
      schedules: scheds.map((s) => ({
        id: s.id,
        cronExpr: s.cronExpr,
        enabled: !!s.enabled,
        nextRunAt: s.nextRunAt,
        lastRunAt: s.lastRunAt,
      })),
      webhooks: hooks.map((w) => ({
        id: w.id,
        url: `/api/webhooks/${w.token}`,
        secret: editor ? w.secret : null,
        enabled: !!w.enabled,
      })),
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes.split(",").filter(Boolean),
        lastUsedAt: k.lastUsedAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
