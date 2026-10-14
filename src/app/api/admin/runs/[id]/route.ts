import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { runNodes, runs } from "@/db/schema";
import { fail } from "@/lib/auth";
import { audit, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { id } = await params;
    const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    const nodes = await db.select().from(runNodes).where(eq(runNodes.runId, id)).orderBy(asc(runNodes.createdAt));
    return NextResponse.json({
      run: { id: run.id, status: run.status, trigger: run.trigger, error: run.error, costUsd: run.totalCostUsd / 1e6, durationMs: run.durationMs, createdAt: run.createdAt },
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId,
        status: n.status,
        model: n.model,
        costUsd: n.costUsd / 1e6,
        durationMs: n.durationMs,
        error: n.error,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

/** Ask a running or queued run to stop. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { id } = await params;
    const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    if (run.status !== "queued" && run.status !== "running") {
      return NextResponse.json({ error: "That run has already finished." }, { status: 409 });
    }
    await db.update(runs).set({ cancelRequested: true }).where(eq(runs.id, id));
    await audit(gate.actor, "run.cancel", { type: "run", id }, { orgId: run.orgId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
