import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { fail } from "@/lib/auth";
import { audit, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

/** `{ action: "retry" }` puts a failed job back in the queue; `"drop"` removes a stuck one. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { id } = await params;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (body.action === "retry") {
      if (job.status !== "error") return NextResponse.json({ error: "Only failed jobs can be retried." }, { status: 409 });
      await db
        .update(jobs)
        .set({ status: "queued", runAt: new Date(), attempts: 0, lastError: null, finishedAt: null })
        .where(eq(jobs.id, id));
    } else if (body.action === "drop") {
      if (job.status === "running") return NextResponse.json({ error: "A running job can't be dropped." }, { status: 409 });
      await db.delete(jobs).where(eq(jobs.id, id));
    } else {
      return NextResponse.json({ error: "action must be retry or drop." }, { status: 400 });
    }
    await audit(gate.actor, `job.${body.action}`, { type: "job", id }, { kind: job.kind, orgId: job.orgId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
