import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { graphs, organizations, runs } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

const STATUSES = ["queued", "running", "done", "error", "canceled"];

/** Recent runs across every workspace, newest first. */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const sp = req.nextUrl.searchParams;
    const status = STATUSES.find((s) => s === sp.get("status"));
    const q = (sp.get("q") ?? "").trim().slice(0, 60).replace(/[%_\\]/g, "\\$&");
    const rows = await db
      .select({ r: runs, org: organizations.name, project: graphs.title })
      .from(runs)
      .leftJoin(organizations, eq(organizations.id, runs.orgId))
      .leftJoin(graphs, eq(graphs.id, runs.graphId))
      .where(
        and(
          status ? eq(runs.status, status) : undefined,
          q ? or(ilike(organizations.name, `%${q}%`), ilike(graphs.title, `%${q}%`), ilike(runs.id, `${q}%`)) : undefined,
        ),
      )
      .orderBy(desc(runs.createdAt))
      .limit(100);
    return NextResponse.json({
      runs: rows.map(({ r, org, project }) => ({
        id: r.id,
        workspace: org ?? "—",
        orgId: r.orgId,
        project: project ?? "—",
        status: r.status,
        trigger: r.trigger,
        costUsd: r.totalCostUsd / 1e6,
        durationMs: r.durationMs,
        error: r.error,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
