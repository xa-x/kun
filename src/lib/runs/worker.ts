import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, runs } from "@/db/schema";
import { executeGraph } from "../engine";
import { claimNextJob, finishJob } from "../jobs";
import { tickSchedules } from "../cron";
import type { GraphDoc, NodeOutput } from "../types";

const g = globalThis as unknown as { __kunJobs?: boolean };

async function processRunJob(runId: string, orgId: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error("Run not found");
  const graph = (run.snapshot ?? { nodes: [], edges: [] }) as GraphDoc;
  const input = (run.input ?? {}) as {
    from?: string;
    only?: string;
    cached?: Record<string, NodeOutput[]>;
  };
  await db
    .update(runs)
    .set({ status: "running", heartbeatAt: new Date() })
    .where(eq(runs.id, runId));

  const ac = new AbortController();
  const beat = setInterval(async () => {
    const [fresh] = await db
      .select({ c: runs.cancelRequested })
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);
    if (fresh?.c) ac.abort();
    await db.update(runs).set({ heartbeatAt: new Date() }).where(eq(runs.id, runId));
  }, 2000);

  try {
    for await (const ev of executeGraph(graph, {
      graphId: run.graphId,
      orgId,
      runId,
      only: input.only,
      from: input.from,
      cached: input.cached,
      signal: ac.signal,
    })) {
      if (ev.type === "run" && ev.status === "cancelled") break;
    }
  } finally {
    clearInterval(beat);
  }
}

/** A live worker beats every 2s; this long without one means it died. */
const STALE_RUN_MS = 2 * 60_000;

/**
 * Fail runs whose worker stopped (deploy, crash) so they don't sit in
 * "running" forever, and close out the jobs that were driving them.
 */
async function reapStaleRuns() {
  const dead = await db
    .update(runs)
    .set({
      status: "error",
      error: "The server stopped while this run was in progress. Run it again.",
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(runs.status, "running"),
        lt(runs.heartbeatAt, new Date(Date.now() - STALE_RUN_MS)),
      ),
    )
    .returning({ id: runs.id });
  if (!dead.length) return;
  await db
    .update(jobs)
    .set({ status: "error", lastError: "worker stopped", finishedAt: new Date() })
    .where(
      and(
        eq(jobs.status, "running"),
        inArray(
          sql`${jobs.payload}->>'runId'`,
          dead.map((r) => r.id),
        ),
      ),
    );
}

export async function tickJobs() {
  try {
    await tickSchedules();
  } catch (e) {
    console.error("[jobs] schedule tick failed:", errorSummary(e));
  }
  try {
    await reapStaleRuns();
  } catch (e) {
    console.error("[jobs] stale-run sweep failed:", errorSummary(e));
  }
  // This runs from a timer with nothing awaiting it, so anything that rejects
  // here (a dropped database connection, say) would surface as an unhandled
  // rejection and take the whole server process down. Log it and try again on
  // the next tick instead.
  try {
    for (let i = 0; i < 4; i++) {
      const job = await claimNextJob();
      if (!job) break;
      try {
        if (job.kind === "run") {
          const payload = job.payload as { runId?: string };
          if (!payload.runId) throw new Error("run job missing runId");
          await processRunJob(payload.runId, job.orgId);
        }
        await finishJob(job.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await finishJob(job.id, msg);
        if (job.kind === "run") {
          const payload = job.payload as { runId?: string };
          if (payload.runId) {
            await db
              .update(runs)
              .set({ status: "error", error: msg, finishedAt: new Date() })
              .where(eq(runs.id, payload.runId));
          }
        }
      }
    }
  } catch (e) {
    console.error("[jobs] job tick failed:", errorSummary(e));
  }
}

/** One readable line, including the underlying cause (e.g. ECONNREFUSED). */
function errorSummary(e: unknown) {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause as { code?: string; message?: string } | undefined;
  const why = cause?.code || cause?.message;
  return why ? `${e.message.split("\n")[0]} (${why})` : e.message.split("\n")[0];
}

export function ensureJobLoop() {
  if (g.__kunJobs) return;
  g.__kunJobs = true;
  setInterval(() => {
    void tickJobs();
  }, 2500);
  void tickJobs();
}
