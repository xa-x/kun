import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { graphs } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canEdit } from "@/lib/tenant";
import { publishDoc } from "@/lib/publish";
import type { GraphDoc } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/graphs/[id]/publish — make the saved project the live version.
 * Schedules and webhooks run the live version, so edits in progress never go
 * out until someone publishes them.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    if (!canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const [g] = await db.select().from(graphs).where(eq(graphs.id, id)).limit(1);
    if (!g || g.orgId !== actor.org.id) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const doc = publishDoc(g.graph as GraphDoc);
    await db.update(graphs).set({ publishedGraph: doc }).where(eq(graphs.id, id));
    return NextResponse.json({ publishedAt: doc.publishedAt });
  } catch (e) {
    return fail(e);
  }
}
