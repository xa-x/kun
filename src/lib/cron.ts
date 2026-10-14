import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { organizations, schedules } from "@/db/schema";
import { enqueueRun } from "./runs/enqueue";

export { nextCron } from "./cron-expr";
import { nextCron } from "./cron-expr";

export async function tickSchedules() {
  const due = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, new Date())));
  for (const row of due) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, row.orgId))
      .limit(1);
    try {
      await enqueueRun(
        {
          orgId: row.orgId,
          graphId: row.graphId,
          trigger: "schedule",
          published: true,
          input: (row.inputs as Record<string, unknown>) ?? {},
          idempotencyKey: `sched:${row.id}:${row.nextRunAt?.getTime() ?? Date.now()}`,
        },
        org?.plan ?? "free",
      );
    } catch (e) {
      console.error("[cron] enqueue failed", row.id, e);
    }
    let next: Date;
    try {
      next = nextCron(row.cronExpr, new Date());
    } catch {
      next = new Date(Date.now() + 86_400_000);
    }
    await db
      .update(schedules)
      .set({ lastRunAt: new Date(), nextRunAt: next })
      .where(eq(schedules.id, row.id));
  }
}
