import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { jobs, organizations } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const [counts, rows] = await Promise.all([
      db.select({ status: jobs.status, v: count() }).from(jobs).groupBy(jobs.status),
      db
        .select({ j: jobs, org: organizations.name })
        .from(jobs)
        .leftJoin(organizations, eq(organizations.id, jobs.orgId))
        .where(inArray(jobs.status, ["queued", "running", "error"]))
        .orderBy(desc(jobs.createdAt))
        .limit(100),
    ]);
    return NextResponse.json({
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.v)])),
      jobs: rows.map(({ j, org }) => ({
        id: j.id,
        kind: j.kind,
        status: j.status,
        workspace: org ?? "—",
        attempts: j.attempts,
        error: j.lastError,
        runAt: j.runAt,
        createdAt: j.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
