import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { newId } from "./ids";

export type JobKind = "run" | "schedule_tick";

export async function enqueueJob(
  orgId: string,
  kind: JobKind,
  payload: Record<string, unknown>,
  runAt = new Date(),
) {
  const id = newId(16);
  await db.insert(jobs).values({
    id,
    orgId,
    kind,
    payload,
    status: "queued",
    runAt,
  });
  return id;
}

/**
 * Claim the oldest due job. The update only succeeds while the row is still
 * queued, so overlapping ticks (or several server instances) can never run
 * the same job twice — the loser just moves on to the next candidate.
 */
export async function claimNextJob() {
  const now = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, now)))
      .orderBy(asc(jobs.runAt))
      .limit(1);
    if (!row) return null;
    const [claimed] = await db
      .update(jobs)
      .set({
        status: "running",
        attempts: row.attempts + 1,
        startedAt: now,
      })
      .where(and(eq(jobs.id, row.id), eq(jobs.status, "queued")))
      .returning();
    if (claimed) return claimed;
  }
  return null;
}

export async function finishJob(id: string, error?: string) {
  await db
    .update(jobs)
    .set({
      status: error ? "error" : "done",
      lastError: error ?? null,
      finishedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}
