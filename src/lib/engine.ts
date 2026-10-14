import { eq } from "drizzle-orm";
import type { GraphDoc, NodeOutput, RunEvent, UsageInfo } from "./types";
import { runNode, providerFor, modelFor, asError } from "./runners";
import { transientMessage } from "./provider-errors";
import { isRunnableKind } from "./nodes";
import { nodeDef } from "./nodes";
import { freshSourceIds, hasOutputNode, inertNodeIds } from "./graph";
import { db } from "@/db";
import { runs, runNodes } from "@/db/schema";
import { newId } from "./ids";
import { downstreamIds } from "./graph";
import { appendEvent } from "./runs/events";
import { recordUsage } from "./runs/enqueue";
import { writeNodeOutputToGraph } from "./runs/persist-graph";

const MAX_CONCURRENCY = 4;

/**
 * Execute a graph in topological order with a small worker pool.
 * Independent nodes run concurrently; upstream outputs are gathered by
 * target handle before a node starts. Every execution is persisted as a
 * `run` row + per-node `run_nodes` rows, and live events (status + token
 * deltas + usage) stream back to the canvas.
 *
 * `only` = run a single node (inputs come from `cached` upstream outputs).
 * `from` = run that node and every descendant (other branches keep going).
 * In both partial modes, input-less source nodes wired into the scope (Text,
 * Instruction, Skill, uploads) run fresh instead of serving cached output.
 */
export async function* executeGraph(
  graph: GraphDoc,
  opts: {
    graphId?: string;
    orgId?: string;
    runId?: string;
    only?: string;
    from?: string;
    /** Run exactly these nodes (a group), reading everything else from `cached`. */
    nodes?: string[];
    cached?: Record<string, NodeOutput[]>;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<RunEvent> {
  const runId = opts.runId ?? newId();
  const orgId = opts.orgId ?? "";
  // Comments and groups annotate the canvas; they never run.
  const runnable = graph.nodes.filter((n) => isRunnableKind(n.data.kind));
  const nodes = new Map(runnable.map((n) => [n.id, n]));
  const edges = graph.edges.filter(
    (e) => nodes.has(e.source) && nodes.has(e.target),
  );

  const outputs = new Map<string, NodeOutput[]>(
    Object.entries(opts.cached ?? {}),
  );
  // A frozen node serves the result saved with the graph, so schedules and API
  // runs (which send no cached results) still have something to read from it.
  for (const n of runnable) {
    const saved = n.data.outputs as NodeOutput[] | undefined;
    if (n.data.frozen && saved?.length && !outputs.has(n.id)) outputs.set(n.id, saved);
  }

  // adjacency
  const inDeg = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of runnable) {
    inDeg.set(n.id, 0);
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    incoming.get(e.target)!.push(e.source);
    outgoing.get(e.source)!.push(e.target);
  }

  // event channel
  const queue: RunEvent[] = [];
  let notify: (() => void) | null = null;
  let finished = false;
  const emit = (e: RunEvent) => {
    queue.push(e);
    notify?.();
    if (orgId) {
      const nodeId = "nodeId" in e ? e.nodeId : undefined;
      void appendEvent(orgId, runId, {
        type: e.type,
        level: e.type === "node" && "status" in e && e.status === "error" ? "error" : "info",
        nodeId,
        payload: e as unknown as Record<string, unknown>,
        ts: e.ts,
      });
    }
  };

  const gatherInputs = (nodeId: string) => {
    const inputs: Record<string, NodeOutput[]> = {};
    for (const e of edges) {
      if (e.target !== nodeId) continue;
      const key = e.targetHandle ?? "in";
      let outs = outputs.get(e.source) ?? [];
      // A source handle may declare a port type (e.g. Media Out's three
      // passthrough handles) — only forward results matching it.
      const srcNode = nodes.get(e.source);
      const port =
        srcNode &&
        nodeDef(srcNode.data.kind)?.outputs.find((p) => p.id === e.sourceHandle);
      if (port && port.type !== "json" && port.type !== "any")
        outs = outs.filter((o) => o.type === port.type);
      // A typed input only takes its own kind, so an "any" source (Output,
      // File) can feed it without handing over results it cannot read.
      const sink = nodeDef(nodes.get(nodeId)?.data.kind ?? "")?.inputs.find(
        (p) => p.id === key,
      );
      if (sink && sink.type !== "json" && sink.type !== "any")
        outs = outs.filter((o) => o.type === sink.type);
      (inputs[key] ??= []).push(...outs);
    }
    return inputs;
  };

  // ---- run persistence (best effort — never block execution) ----
  const totals = { costUsd: 0, tokens: 0 };
  const runStarted = Date.now();
  const isCancelled = async () => {
    if (opts.signal?.aborted) return true;
    if (!opts.graphId) return false;
    const [row] = await db
      .select({ c: runs.cancelRequested })
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);
    return !!row?.c;
  };

  const persistRun = async (status: string, error?: string) => {
    if (!opts.graphId) return;
    try {
      const finished = ["done", "error", "cancelled", "timed_out"].includes(status);
      await db
        .insert(runs)
        .values({
          id: runId,
          orgId,
          graphId: opts.graphId,
          status,
          trigger: opts.only || opts.from || opts.nodes?.length ? "node" : "manual",
          only: opts.only ?? opts.from ?? (opts.nodes?.length ? "group" : null),
          totalCostUsd: Math.round(totals.costUsd * 1e6),
          totalTokens: totals.tokens,
          durationMs: Date.now() - runStarted,
          error: error ?? null,
          heartbeatAt: new Date(),
          startedAt: new Date(runStarted),
          finishedAt: finished ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: runs.id,
          set: {
            status,
            orgId,
            totalCostUsd: Math.round(totals.costUsd * 1e6),
            totalTokens: totals.tokens,
            durationMs: Date.now() - runStarted,
            error: error ?? null,
            heartbeatAt: new Date(),
            finishedAt: finished ? new Date() : null,
          },
        });
      if (orgId && finished && (totals.costUsd || totals.tokens)) {
        await recordUsage({
          orgId,
          runId,
          amountUsd: Math.round(totals.costUsd * 1e6),
          tokens: totals.tokens,
        });
      }
    } catch {
      /* best effort */
    }
  };

  const persistNode = async (
    nodeId: string,
    status: string,
    result?: { outputs?: NodeOutput[]; usage?: UsageInfo },
    error?: string,
    startedAt?: number,
    data?: { kind: string; provider?: string; model?: string },
  ) => {
    if (!opts.graphId) return;
    try {
      await db
        .insert(runNodes)
        .values({
          id: `${runId}:${nodeId}`,
          orgId,
          runId,
          graphId: opts.graphId,
          nodeId,
          status,
          output: result?.outputs ?? null,
          error: error ?? null,
          model: data?.model ?? modelFor(data as never) ?? null,
          provider: data?.provider ?? (data ? providerFor(data as never) : null),
          costUsd: Math.round((result?.usage?.costUsd ?? 0) * 1e6),
          tokensIn: result?.usage?.tokensIn ?? 0,
          tokensOut: result?.usage?.tokensOut ?? 0,
          durationMs: startedAt ? Date.now() - startedAt : null,
          startedAt: startedAt ? new Date(startedAt) : null,
          finishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: runNodes.id,
          set: {
            status,
            output: result?.outputs ?? null,
            error: error ?? null,
            costUsd: Math.round((result?.usage?.costUsd ?? 0) * 1e6),
            tokensIn: result?.usage?.tokensIn ?? 0,
            tokensOut: result?.usage?.tokensOut ?? 0,
            durationMs: startedAt ? Date.now() - startedAt : null,
            finishedAt: new Date(),
          },
        });
      await writeNodeOutputToGraph(opts.graphId, nodeId, {
        outputs: result?.outputs,
        runStatus:
          status === "skipped"
            ? "skipped"
            : status === "error"
              ? "error"
              : status === "running"
                ? "running"
                : "done",
        runError: error ?? null,
        runUsage: result?.usage,
      });
    } catch {
      /* best effort */
    }
  };

  // scheduler (detached)
  const state = { failedAny: false, cancelled: false };
  void persistRun("running");
  const schedule = (async () => {
    const failed = new Set<string>();
    const skipped = new Set<string>();
    const settled = new Set<string>();
    const pending: string[] = [];

    const released = new Set<string>();

    const scope = opts.only
      ? new Set([opts.only])
      : opts.nodes?.length
        ? new Set(opts.nodes.filter((id) => nodes.has(id)))
        : opts.from && nodes.has(opts.from)
          ? new Set(downstreamIds(opts.from, edges))
          : null;

    // A from/only run must not read a Text/Instruction/Upload node through a
    // missing or stale cached output — those nodes are free, so run them
    // fresh alongside the requested scope.
    if (scope)
      for (const id of freshSourceIds(runnable, edges, scope)) scope.add(id);

    // Every node shows its own result, so a full run runs them all. Graphs
    // saved with an Output node keep their old rule: never spend a generation
    // on a node that does not lead into one. Running a single node is explicit
    // intent, so that node is always allowed.
    const inert =
      opts.only || !hasOutputNode(runnable)
        ? new Set<string>()
        : inertNodeIds(runnable, edges);
    if (opts.from) inert.delete(opts.from);
    // Running a group is explicit intent for everything inside it.
    if (opts.nodes && scope) for (const id of scope) inert.delete(id);

    if (scope) {
      for (const id of scope) inDeg.set(id, 0);
      for (const e of edges) {
        if (scope.has(e.source) && scope.has(e.target))
          inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
      }
    }

    const release = (id: string) => {
      if (released.has(id)) return;
      released.add(id);
      for (const t of outgoing.get(id) ?? []) {
        if (scope && !scope.has(t)) continue;
        const d = (inDeg.get(t) ?? 1) - 1;
        inDeg.set(t, d);
        if (d === 0) pending.push(t);
      }
    };

    if (opts.only) {
      pending.push(opts.only);
    } else if (scope) {
      for (const id of scope)
        if ((inDeg.get(id) ?? 0) === 0) pending.push(id);
    } else {
      for (const n of runnable)
        if ((inDeg.get(n.id) ?? 0) === 0) pending.push(n.id);
    }

    const runOne = async (nodeId: string) => {
      const node = nodes.get(nodeId);
      if (!node) return;
      const started = Date.now();
      emit({ type: "node", nodeId, status: "running", ts: started });
      await persistNode(nodeId, "running", undefined, undefined, started, node.data);
      try {
        const result = await runNode(nodeId, node.data, gatherInputs(nodeId), {
          emit,
          nodeId,
          orgId,
          runId,
        });
        outputs.set(nodeId, result.outputs);
        totals.costUsd += result.usage?.costUsd ?? 0;
        totals.tokens += (result.usage?.tokensIn ?? 0) + (result.usage?.tokensOut ?? 0);
        emit({
          type: "node",
          nodeId,
          status: "done",
          outputs: result.outputs,
          usage: result.usage,
          ts: Date.now(),
        });
        await persistNode(nodeId, "done", result, undefined, started, node.data);
      } catch (err) {
        const friendly = transientMessage(err);
        // The raw provider error stays in the server log; the user gets the friendly line.
        if (friendly) console.error(`[engine] node ${nodeId} hit a transient provider error:`, err);
        const msg = friendly ?? asError(err).message;
        failed.add(nodeId);
        state.failedAny = true;
        emit({ type: "node", nodeId, status: "error", error: msg, ts: Date.now() });
        await persistNode(nodeId, "error", undefined, msg, started, node.data);
      } finally {
        settled.add(nodeId);
        release(nodeId);
      }
    };

    const executing = new Set<Promise<void>>();
    while (pending.length || executing.size) {
      if (await isCancelled()) {
        state.cancelled = true;
        break;
      }
      while (pending.length && executing.size < MAX_CONCURRENCY) {
        const id = pending.shift()!;
        if (settled.has(id)) continue;
        const up = incoming.get(id) ?? [];
        const target = nodes.get(id);
        // A frozen node keeps its last result and is not run again; what
        // follows it reads that result and runs as normal. Asking for it by
        // itself (Run on the node) still runs it.
        if (target?.data.frozen && opts.only !== id) {
          // No event and no record: as far as the canvas is concerned nothing
          // happened to it, and its card keeps showing its result.
          settled.add(id);
          release(id);
          continue;
        }
        const reason = inert.has(id)
          ? "skipped: nothing is connected to this node's output"
          : // a broken upstream only skips in full-run mode
            opts.only
            ? null
            : up.some((s) => failed.has(s))
              ? "skipped: upstream failed"
              : up.some((s) => skipped.has(s))
                ? "skipped: upstream was skipped"
                : null;
        if (reason) {
          settled.add(id);
          skipped.add(id);
          emit({
            type: "node",
            nodeId: id,
            status: "skipped",
            error: reason,
            ts: Date.now(),
          });
          await persistNode(id, "skipped", undefined, reason);
          release(id);
          continue;
        }
        const p = runOne(id).finally(() => executing.delete(p));
        executing.add(p);
      }
      if (executing.size) await Promise.race(executing);
    }
  })();

  emit({ type: "run", runId, status: "started", ts: Date.now() });

  schedule
    .catch(async (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[engine] scheduler crashed:", e);
      state.failedAny = true;
      await persistRun("error", msg);
    })
    .finally(async () => {
      finished = true;
      const status = state.cancelled ? "cancelled" : state.failedAny ? "error" : "done";
      await persistRun(status);
      emit({
        type: "run",
        runId,
        status,
        usage: {
          totalCostUsd: totals.costUsd,
          totalTokens: totals.tokens,
          durationMs: Date.now() - runStarted,
        },
        ts: Date.now(),
      });
      notify?.();
    });

  // stream events as they happen
  while (!finished || queue.length) {
    if (!queue.length) {
      await new Promise<void>((r) => (notify = r));
      notify = null;
      continue;
    }
    yield queue.shift()!;
  }
}
