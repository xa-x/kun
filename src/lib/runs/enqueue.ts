import { and, eq, gte, sql } from "drizzle-orm";
import { platform } from "../platform";
import { isSuspended } from "../workspace-settings";
import { db } from "@/db";
import { graphs, organizations, runs, usageLedger } from "@/db/schema";
import { allowance, monthStart, planOf, PlanLimitError, splitCharge } from "../billing";
import { memberCount } from "../limits";
import { enqueueJob } from "../jobs";
import { newId } from "../ids";
import { snapshotWorkbook } from "../versions";
import { applyRunInputs } from "../run-inputs";
import type { GraphDoc, NodeOutput } from "../types";

export type RunTrigger = "manual" | "node" | "schedule" | "webhook" | "api" | "mcp";

export interface EnqueueInput {
  orgId: string;
  userId?: string;
  graphId: string;
  trigger: RunTrigger;
  only?: string;
  /** Run exactly these nodes: a group, run apart from the rest. */
  nodes?: string[];
  from?: string;
  cached?: Record<string, NodeOutput[]>;
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  graphOverride?: GraphDoc;
  published?: boolean;
}

export async function countMonthlyRuns(orgId: string) {
  const since = new Date(monthStart());
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(runs)
    .where(and(eq(runs.orgId, orgId), gte(runs.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}

/**
 * Usage charged to this month's included credits, in micro-dollars (the
 * ledger's unit) — everything billed minus what the prepaid balance paid.
 */
export async function includedSpendMicroUsd(
  orgId: string,
  q: Pick<typeof db, "select"> = db,
) {
  const since = new Date(monthStart());
  const rows = await q
    .select({
      n: sql<number>`coalesce(sum(${usageLedger.amountUsd} - ${usageLedger.balanceUsd}), 0)`,
    })
    .from(usageLedger)
    .where(and(eq(usageLedger.orgId, orgId), gte(usageLedger.createdAt, since)));
  return Number(rows[0]?.n ?? 0);
}

/**
 * Refuse work that spends the platform's model key once the org has used its
 * included monthly credits and has no prepaid balance left. Checked before a
 * run starts, so the run that crosses the line still finishes — the limit can
 * be overshot by one run.
 */
export async function assertWithinCredits(orgId: string, planId: string) {
  const plan = planOf(planId);
  const credits = allowance(plan, await memberCount(orgId)).creditsUsd;
  const spent = await includedSpendMicroUsd(orgId);
  if (spent < credits * 1e6) return;
  const [org] = await db
    .select({ balance: organizations.creditBalance })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if ((org?.balance ?? 0) > 0) return;
  throw new PlanLimitError(
    `This workspace used its $${credits} of included model credits for the month. ` +
      (plan.topups
        ? "Add credits in Billing to keep running."
        : "Upgrade to Pro to add more."),
  );
}

export async function enqueueRun(input: EnqueueInput, planId: string) {
  const plan = planOf(planId);
  const maintenance = (await platform()).maintenance;
  if (maintenance.on) {
    throw Object.assign(new Error(maintenance.message), { status: 503 });
  }
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, input.orgId))
    .limit(1);
  if (isSuspended(org?.settings)) {
    throw Object.assign(new Error("This workspace is suspended. Contact support to restore it."), { status: 403 });
  }
  if (input.trigger === "schedule" && !plan.schedules) {
    throw new PlanLimitError("Schedules are available on Pro and Team.");
  }
  if (input.trigger === "webhook" && !plan.webhooks) {
    throw new PlanLimitError("Webhooks are available on Pro and Team.");
  }
  if (input.trigger === "mcp" && !plan.mcp) {
    throw new PlanLimitError("MCP is available on Pro and Team.");
  }
  const used = await countMonthlyRuns(input.orgId);
  const runLimit = allowance(plan, await memberCount(input.orgId)).runs;
  if (used >= runLimit) {
    throw new PlanLimitError(`This workspace reached its ${runLimit} monthly run limit.`);
  }
  await assertWithinCredits(input.orgId, planId);

  if (input.idempotencyKey) {
    const [hit] = await db
      .select()
      .from(runs)
      .where(
        and(eq(runs.orgId, input.orgId), eq(runs.idempotencyKey, input.idempotencyKey)),
      )
      .limit(1);
    if (hit) return { run: hit, reused: true };
  }

  if (!input.graphId) {
    throw Object.assign(new Error("graphId required"), { status: 400 });
  }
  const [graph] = await db
    .select()
    .from(graphs)
    .where(eq(graphs.id, input.graphId))
    .limit(1);
  if (!graph || graph.orgId !== input.orgId) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }

  const base =
    input.graphOverride ??
    (input.published && graph.publishedGraph
      ? (graph.publishedGraph as GraphDoc)
      : (graph.graph as GraphDoc));
  // Values sent with the run (a webhook body, a schedule's inputs, an API
  // call) fill the project's Text nodes for this run only.
  const { doc: snapshot, applied, ignored } = applyRunInputs(base, input.input);

  if (plan.versions && input.trigger === "manual") {
    await snapshotWorkbook(input.orgId, input.graphId, snapshot, "run", input.userId);
  }

  const runId = newId();
  const [run] = await db
    .insert(runs)
    .values({
      id: runId,
      orgId: input.orgId,
      graphId: input.graphId,
      status: "queued",
      trigger:
        input.trigger === "node" || input.only || input.from || input.nodes?.length
          ? "node"
          : input.trigger,
      only: input.only ?? input.from ?? (input.nodes?.length ? "group" : null),
      snapshot,
      input: {
        from: input.from,
        only: input.only,
        nodes: input.nodes,
        cached: input.cached ?? {},
        extra: input.input ?? {},
      },
      idempotencyKey: input.idempotencyKey ?? null,
      startedAt: new Date(),
    })
    .returning();

  await enqueueJob(input.orgId, "run", { runId });
  void import("./worker").then((m) => m.tickJobs());
  return { run: run!, reused: false, inputs: { applied, ignored } };
}

export async function recordUsage(opts: {
  orgId: string;
  runId?: string;
  /** What spent it: a project run, or a model call outside one. */
  kind?: "run" | "assistant" | "skill";
  amountUsd: number;
  tokens: number;
  model?: string;
  provider?: string;
}) {
  await db.transaction(async (tx) => {
    // Lock the org row so concurrent charges split against one balance.
    const [org] = await tx
      .select({ plan: organizations.plan, balance: organizations.creditBalance })
      .from(organizations)
      .where(eq(organizations.id, opts.orgId))
      .limit(1)
      .for("update");
    const includedLeft =
      allowance(planOf(org?.plan), await memberCount(opts.orgId)).creditsUsd * 1e6 -
      (await includedSpendMicroUsd(opts.orgId, tx));
    const { fromBalance } = splitCharge(opts.amountUsd, includedLeft, org?.balance ?? 0);
    if (fromBalance) {
      await tx
        .update(organizations)
        .set({ creditBalance: sql`${organizations.creditBalance} - ${fromBalance}` })
        .where(eq(organizations.id, opts.orgId));
    }
    await tx.insert(usageLedger).values({
      id: newId(),
      orgId: opts.orgId,
      runId: opts.runId,
      kind: opts.kind ?? "run",
      amountUsd: opts.amountUsd,
      balanceUsd: fromBalance,
      tokens: opts.tokens,
      model: opts.model,
      provider: opts.provider,
    });
  });
}
