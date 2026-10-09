"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type IsValidConnection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  NODE_TYPES,
  matchPorts,
  nodeDef,
  portAccepts,
  portDef,
} from "@/lib/nodes";
import type {
  FlowNodeData,
  GraphDoc,
  NodeData,
  NodeOutput,
  RunEvent,
} from "@/lib/types";
import { ModelCatalogProvider, useModelCatalog } from "@/lib/model-catalog";
import { kindForNode } from "@/lib/models";
import {
  pickRecentDefault,
  recentsFor,
  recordRecent,
} from "@/lib/recent-models";
import { starterGraph } from "@/lib/starter";
import { downstreamIds } from "@/lib/graph";
import { layoutGraph } from "@/lib/layout";
import { watchRunEvents } from "@/lib/runs/watch";
import { fmtUsd } from "@/lib/format";
import { useSettings } from "@/lib/use-settings";
import { GraphHistory } from "@/lib/history";
import { parsePortable, remapPortable, toPortable } from "@/lib/portable";
import { AssistantPanel } from "./AssistantPanel";
import { FlowNode } from "./FlowNode";
import { DND_MIME, Palette } from "./Palette";
import { PlayBar } from "./PlayBar";
import { CanvasToolbar } from "./CanvasToolbar";
import { PORT_COLOR } from "./node/tokens";
import { APP_HOME } from "@/lib/routes";
import { RunsPanel } from "./RunsPanel";
import { SettingsModal } from "./SettingsModal";
import { StatusScreen } from "./StatusScreen";
import { MiniConsole, type ConsoleLine } from "./MiniConsole";
import { PublishTemplate } from "./PublishTemplate";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { useTheme } from "./ThemeProvider";

type FN = Node<FlowNodeData, "flow">;

const nodeTypes = { flow: FlowNode };

export function Canvas({
  graphId,
  startAssistant = false,
  startRuns = false,
  startMini = false,
  shareToken,
  readOnly = false,
}: {
  graphId: string;
  startAssistant?: boolean;
  startRuns?: boolean;
  startMini?: boolean;
  shareToken?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<FN>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [title, setTitle] = useState("Untitled");
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showMini, setShowMini] = useState(startMini);
  const [showRuns, setShowRuns] = useState(startRuns);
  const [showAssistant, setShowAssistant] = useState(startAssistant);
  const [showPublish, setShowPublish] = useState(false);
  const [books, setBooks] = useState<
    { id: string; title: string; updatedAt?: string | number }[]
  >([]);
  const [missing, setMissing] = useState(false);
  const [ready, setReady] = useState(false);
  const settingsApi = useSettings();
  const theme = useTheme();
  const historyRef = useRef(new GraphHistory());
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runCostUsd, setRunCostUsd] = useState<number | null>(null);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  useEffect(() => {
    try {
      // Restored after mount so the server and first client render agree.
      if (sessionStorage.getItem("kun.console.collapsed") === "1")
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConsoleCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "kun.console.collapsed",
        consoleCollapsed ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [consoleCollapsed]);
  // Panel toggles sync back to the URL so a refresh (or a shared link)
  // restores them; initial state arrives via server-rendered searchParams.
  const syncPanelFlag = useCallback((key: string, on: boolean) => {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set(key, "1");
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  }, []);
  const { catalog, reload: reloadCatalog } = useModelCatalog(
    settingsApi.env,
  );
  // New nodes start on the most recently used model that its provider still
  // lists — then the curated picks, then any live model — so a retired
  // default can't 404 the first run. Recents are read from localStorage at
  // call time, so picks and runs from this session count immediately.
  const defaultModelFor = useCallback(
    (kind: string): { model: string; provider?: string } => {
      const need = kindForNode(kind);
      if (!need) return { model: "" };
      return pickRecentDefault(
        recentsFor(kind),
        nodeDef(kind)?.models ?? [],
        catalog.models,
        catalog.errors,
        need,
      );
    },
    [catalog],
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outputsRef = useRef<Record<string, NodeOutput[]>>({});
  const inflightRef = useRef(new Set<AbortController>());
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const stoppingRef = useRef(false);
  const watchAbortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const attachRunRef = useRef<(id: string) => Promise<void>>(async () => {});
  const rf = useReactFlow();
  // Latest-value refs for callbacks; synced before any passive effect runs.
  useLayoutEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    activeRunIdRef.current = activeRunId;
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
        shareToken
          ? `/api/graphs/${graphId}?share=${encodeURIComponent(shareToken)}`
          : `/api/graphs/${graphId}`,
      );
        if (res.status === 404) {
          if (alive) setMissing(true);
          return;
        }
        const { graph: g } = await readJson<{ graph?: { id: string; title: string; graph?: { nodes?: FN[]; edges?: Edge[]; viewport?: { x: number; y: number; zoom: number } } } }>(res);
        if (!alive || !g) return;
        setTitle(g.title);
        const loaded = (g.graph?.nodes ?? []).map(
          (n: {
            id: string;
            position: { x: number; y: number };
            data: FlowNodeData;
          }) =>
            ({
              id: n.id,
              type: "flow",
              position: n.position,
              data: n.data,
            }) as FN,
        );
        setNodes(loaded);
        setEdges(
          (g.graph?.edges ?? []).map((e: Edge) => ({
            ...e,
            type: e.type ?? "smoothstep",
          })),
        );
        outputsRef.current = Object.fromEntries(
          loaded
            .filter((n) => n.data.outputs?.length)
            .map((n) => [n.id, n.data.outputs as NodeOutput[]]),
        );
        setDirty(false);
        setReady(true);
        const viewport = g.graph?.viewport;
        if (viewport)
          setTimeout(() => rf.setViewport(viewport, { duration: 0 }), 80);
      } catch {
        if (alive) {
          toast("Couldn’t load this workbook.", "error");
          setMissing(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId]);

  useEffect(() => {
    return () => {
      watchAbortRef.current?.abort();
    };
  }, [graphId]);

  useEffect(() => {
    if (!ready || readOnly) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/runs?graphId=${graphId}&limit=1`);
        const j = await readJson<{
          runs?: { id: string; status: string; totalCostUsd: number }[];
        }>(res);
        const latest = j.runs?.[0];
        if (!alive || !latest) return;
        if (latest.totalCostUsd)
          setRunCostUsd(latest.totalCostUsd / 1e6);
        if (latest.status === "queued" || latest.status === "running") {
          await attachRunRef.current(latest.id);
          return;
        }
        const detail = await fetch(`/api/runs?runId=${latest.id}`);
        const d = await readJson<{
          nodes?: {
            nodeId: string;
            status: string;
            output: NodeOutput[] | null;
            costUsd: number;
            error: string | null;
          }[];
        }>(detail);
        if (!alive || !d.nodes?.length) return;
        setNodes((ns) =>
          ns.map((n) => {
            const row = d.nodes!.find((r) => r.nodeId === n.id);
            if (!row) return n;
            if (n.data.outputs?.length) return n;
            const outputs = (row.output ?? undefined) as NodeOutput[] | undefined;
            if (outputs?.length) outputsRef.current[n.id] = outputs;
            return {
              ...n,
              data: {
                ...n.data,
                runStatus: row.status as FlowNodeData["runStatus"],
                runError: row.error ?? undefined,
                outputs: outputs ?? n.data.outputs,
                runUsage: row.costUsd
                  ? { costUsd: row.costUsd / 1e6 }
                  : n.data.runUsage,
              },
            };
          }),
        );
      } catch {
        /* reconnect is best-effort */
      }
    })();
    return () => {
      alive = false;
    };
    // attachRun is stable enough for mount-time reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, graphId, readOnly]);

  const doc = useMemo(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        position: n.position,
        data: {
          kind: n.data.kind,
          label: n.data.label,
          text: n.data.text,
          prompt: n.data.prompt,
          model: n.data.model,
          provider: n.data.provider,
          voice: n.data.voice,
          size: n.data.size,
          aspectRatio: n.data.aspectRatio,
          duration: n.data.duration,
          resolution: n.data.resolution,
          artifactId: n.data.artifactId,
          skillId: n.data.skillId,
          outputs: n.data.outputs,
          runStatus: n.data.runStatus,
          runError: n.data.runError,
          runUsage: n.data.runUsage,
        } as FlowNodeData,
      })),
      edges,
      viewport: rf.getViewport(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges],
  );

  const refreshBooks = useCallback(async () => {
    try {
      const res = await fetch("/api/graphs");
      const { graphs } = await readJson<{
        graphs?: { id: string; title: string; updatedAt?: string }[];
      }>(res);
      setBooks(
        (graphs ?? []).map(
          (g: { id: string; title: string; updatedAt?: string }) => ({
            id: g.id,
            title: g.title,
            updatedAt: g.updatedAt,
          }),
        ),
      );
    } catch {
      /* list is non-critical */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => refreshBooks(), 0);
    return () => clearTimeout(t);
  }, [refreshBooks]);

  const save = useCallback(
    async (manual = false) => {
      try {
        const res = await fetch("/api/graphs", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: graphId, title, graph: doc }),
        });
        if (!res.ok) throw new Error("Save failed");
        setDirty(false);
        setSaved(new Date().toLocaleTimeString());
        refreshBooks();
        if (manual) setTimeout(() => setSaved(null), 2000);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Save failed", "error");
      }
    },
    [graphId, title, doc, refreshBooks],
  );

  useEffect(() => {
    if (!dirty || !ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dirty, doc, save, ready]);

  const dirtyRef = useRef(dirty);
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    dirtyRef.current = dirty;
    saveRef.current = save;
  });
  useEffect(() => {
    return () => {
      if (dirtyRef.current) void saveRef.current();
    };
  }, [graphId]);

  const applyDoc = useCallback(
    (next: GraphDoc, markDirty = true) => {
      setNodes(
        next.nodes.map(
          (n) =>
            ({
              id: n.id,
              type: "flow",
              position: n.position,
              data: n.data,
            }) as FN,
        ),
      );
      setEdges(next.edges.map((e) => ({ ...e, type: "smoothstep" })));
      if (markDirty) setDirty(true);
    },
    [setNodes, setEdges],
  );

  const snapshotNow = useCallback(() => {
    historyRef.current.remember({
      nodes: nodesRef.current.map((n) => ({
        id: n.id,
        type: "flow",
        position: n.position,
        data: n.data,
      })),
      edges: edgesRef.current.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? null,
        target: e.target,
        targetHandle: e.targetHandle ?? null,
      })),
    });
  }, []);

  const arrange = useCallback(() => {
    snapshotNow();
    const next = layoutGraph({
      nodes: nodesRef.current.map((n) => ({
        id: n.id,
        type: "flow",
        position: n.position,
        data: n.data,
      })),
      edges: edgesRef.current.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle ?? null,
        target: e.target,
        targetHandle: e.targetHandle ?? null,
      })),
    });
    applyDoc(next);
    requestAnimationFrame(() =>
      rf.fitView({ padding: 0.22, duration: 400, maxZoom: 1 }),
    );
  }, [applyDoc, snapshotNow, rf]);

  const touch = useCallback(() => {
    if (readOnly) return;
    snapshotNow();
    setDirty(true);
  }, [readOnly, snapshotNow]);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const { nodeId, patch } = (e as CustomEvent).detail;
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, ...(patch as Partial<FlowNodeData>) } }
            : n,
        ),
      );
      touch();
    };
    const onArtifact = (e: Event) => {
      const { nodeId, artifactId } = (e as CustomEvent).detail;
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, artifactId } } : n,
        ),
      );
      touch();
    };
    const onRemove = (e: Event) => {
      if (readOnly) return;
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      snapshotNow();
      setNodes((ns) => ns.filter((n) => n.id !== nodeId));
      setEdges((es) =>
        es.filter((ed) => ed.source !== nodeId && ed.target !== nodeId),
      );
      setDirty(true);
      toast("Node deleted.", "info", {
        label: "Undo",
        onClick: () => {
          const prev = historyRef.current.undo({
            nodes: nodesRef.current.map((n) => ({
              id: n.id,
              type: "flow",
              position: n.position,
              data: n.data,
            })),
            edges: edgesRef.current.map((ed) => ({
              id: ed.id,
              source: ed.source,
              sourceHandle: ed.sourceHandle ?? null,
              target: ed.target,
              targetHandle: ed.targetHandle ?? null,
            })),
          });
          if (prev) applyDoc(prev);
        },
      });
    };
    const onDuplicate = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      setNodes((ns) => {
        const src = ns.find((n) => n.id === nodeId);
        if (!src) return ns;
        const id = `n${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        return [
          ...ns,
          {
            ...src,
            id,
            selected: false,
            position: { x: src.position.x + 40, y: src.position.y + 40 },
            data: {
              ...src.data,
              runStatus: undefined,
              runError: undefined,
              outputs: undefined,
              streamingText: undefined,
            },
          },
        ];
      });
      touch();
    };
    const onExpandSkill = (e: Event) => {
      if (readOnly) return;
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      const src = nodesRef.current.find((n) => n.id === nodeId);
      if (!src || src.data.kind !== "skill") return;
      const stamp = Date.now().toString(36);
      const llmId = `n${stamp}l`;
      const imgId = `n${stamp}i`;
      const llmDef = nodeDef("llm");
      const imgDef = nodeDef("image.gen");
      if (!llmDef || !imgDef) return;
      snapshotNow();
      setNodes((ns) => [
        ...ns,
        {
          id: llmId,
          type: "flow",
          position: { x: src.position.x + 340, y: src.position.y },
          data: {
            kind: "llm",
            label: llmDef.label,
            ...defaultModelFor("llm"),
            skillId: src.data.skillId,
            prompt: "Turn the skill into a concrete image brief for the next node.",
          },
        },
        {
          id: imgId,
          type: "flow",
          position: { x: src.position.x + 680, y: src.position.y },
          data: {
            kind: "image.gen",
            label: imgDef.label,
            ...defaultModelFor("image.gen"),
          },
        },
      ]);
      setEdges((es) => {
        const next = [...es];
        const a = matchPorts("skill", "llm");
        const b = matchPorts("llm", "image.gen");
        if (a) {
          next.push({
            id: `e${stamp}a`,
            source: nodeId,
            target: llmId,
            sourceHandle: a.sourceHandle,
            targetHandle: a.targetHandle,
            type: "smoothstep",
          });
        }
        if (b) {
          next.push({
            id: `e${stamp}b`,
            source: llmId,
            target: imgId,
            sourceHandle: b.sourceHandle,
            targetHandle: b.targetHandle,
            type: "smoothstep",
          });
        }
        return next;
      });
      setDirty(true);
    };
    window.addEventListener("kun:update", onUpdate);
    window.addEventListener("kun:set-artifact", onArtifact);
    window.addEventListener("kun:remove-node", onRemove);
    window.addEventListener("kun:duplicate-node", onDuplicate);
    window.addEventListener("kun:expand-skill", onExpandSkill);
    return () => {
      window.removeEventListener("kun:update", onUpdate);
      window.removeEventListener("kun:set-artifact", onArtifact);
      window.removeEventListener("kun:remove-node", onRemove);
      window.removeEventListener("kun:duplicate-node", onDuplicate);
      window.removeEventListener("kun:expand-skill", onExpandSkill);
    };
  }, [setNodes, setEdges, touch]);

  const isValidConnection = useCallback<IsValidConnection>(
    (conn) => {
      const src = nodes.find((n) => n.id === conn.source);
      const tgt = nodes.find((n) => n.id === conn.target);
      if (!src || !tgt || src.id === tgt.id) return false;
      const sDef = nodeDef(src.data.kind);
      const tDef = nodeDef(tgt.data.kind);
      const sPort = sDef?.outputs.find((p) => p.id === conn.sourceHandle);
      const tPort = tDef?.inputs.find((p) => p.id === conn.targetHandle);
      if (!sPort || !tPort) return false;
      return portAccepts(tPort.type, sPort.type);
    },
    [nodes],
  );

  const onConnect = useCallback(
    (c: Connection | Edge) => {
      setEdges((eds) =>
        addEdge({ ...c }, eds)
          .filter(
            (e, i, arr) =>
              arr.findIndex(
                (x) =>
                  x.source === e.source &&
                  x.target === e.target &&
                  x.sourceHandle === e.sourceHandle &&
                  x.targetHandle === e.targetHandle,
              ) === i,
          )
          .map((e) => ({ ...e, type: "smoothstep" })),
      );
      touch();
    },
    [setEdges, touch],
  );

  const addAt = useCallback(
    (type: string, x: number, y: number) => {
      const def = nodeDef(type);
      if (!def) return;
      const id = `n${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 5)}`;
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: "flow",
          position: { x, y },
          data: {
            kind: type,
            label: def.label,
            ...defaultModelFor(type),
          },
        },
      ]);
      touch();
    },
    [setNodes, touch, defaultModelFor],
  );

  const addNode = useCallback(
    (type: string) => {
      const c = rf.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      addAt(
        type,
        c.x - 130 + (Math.random() - 0.5) * 90,
        c.y - 40 + (Math.random() - 0.5) * 70,
      );
    },
    [addAt, rf],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DND_MIME);
      if (!type) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addAt(type, p.x - 132, p.y - 16);
    },
    [addAt, rf],
  );

  const onDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer.types.includes(DND_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const [runsTick, setRunsTick] = useState(0);

  const resetInFlight = useCallback(
    (status: "idle" | "error", error?: string, ids?: string[]) => {
      const mine = ids ? new Set(ids) : null;
      setNodes((ns) =>
        ns.map((n) =>
          (n.data.runStatus === "queued" || n.data.runStatus === "running") &&
          (!mine || mine.has(n.id))
            ? {
                ...n,
                data: {
                  ...n.data,
                  runStatus: status,
                  runError: error,
                  streamingText: undefined,
                },
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  const applyRunEvent = useCallback(
    (ev: RunEvent) => {
      if (ev.type === "delta") {
        setNodes((ns) =>
          ns.map((n) =>
            n.id === ev.nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    streamingText: (n.data.streamingText ?? "") + ev.text,
                  },
                }
              : n,
          ),
        );
        return;
      }
      if (ev.type === "run") {
        if (ev.runId) {
          setActiveRunId(ev.runId);
          activeRunIdRef.current = ev.runId;
        }
        if (ev.status !== "started" && ev.usage?.totalCostUsd)
          setRunCostUsd(ev.usage.totalCostUsd);
        setConsoleLines((xs) => [
          ...xs.slice(-80),
          {
            seq: xs.length + 1,
            type: "run",
            level: ev.status === "error" ? "error" : "info",
            status: ev.status,
            ts: ev.ts,
          },
        ]);
        if (
          ev.status === "done" ||
          ev.status === "error" ||
          ev.status === "cancelled" ||
          ev.status === "timed_out"
        ) {
          setRunsTick((t) => t + 1);
          setDirty(true);
        }
        return;
      }
      setConsoleLines((xs) => [
        ...xs.slice(-80),
        {
          seq: xs.length + 1,
          type: "node",
          level: ev.status === "error" ? "error" : "info",
          nodeId: ev.nodeId,
          status: ev.status,
          message: ev.error,
          ts: ev.ts,
        },
      ]);
      setNodes((ns) =>
        ns.map((n) =>
          n.id === ev.nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  runStatus: ev.status,
                  runError: ev.error,
                  outputs: ev.outputs ?? n.data.outputs,
                  runUsage:
                    ev.status === "running" || ev.status === "queued"
                      ? undefined
                      : (ev.usage ?? n.data.runUsage),
                  streamingText:
                    ev.status === "running" || ev.status === "queued"
                      ? n.data.streamingText
                      : undefined,
                },
              }
            : n,
        ),
      );
      if (ev.status === "done" && ev.outputs)
        outputsRef.current[ev.nodeId] = ev.outputs;
      if (ev.status === "done" && ev.usage?.costUsd)
        setRunCostUsd((c) => (c ?? 0) + (ev.usage?.costUsd ?? 0));
      // A completed run is the strongest "recently used" signal — it also
      // learns from graphs built by others (templates, the assistant).
      if (ev.status === "done") {
        const nd = nodesRef.current.find((n) => n.id === ev.nodeId)?.data;
        if (nd?.model && kindForNode(nd.kind))
          recordRecent(nd.kind, {
            id: nd.model,
            provider:
              nd.provider && nd.provider !== "openrouter"
                ? nd.provider
                : undefined,
          });
      }
    },
    [setNodes],
  );

  const attachRun = useCallback(
    async (runId: string) => {
      watchAbortRef.current?.abort();
      const ac = new AbortController();
      watchAbortRef.current = ac;
      inflightRef.current.add(ac);
      setActiveRunId(runId);
      activeRunIdRef.current = runId;
      setRunning(true);
      try {
        await watchRunEvents(runId, { signal: ac.signal, onEvent: applyRunEvent });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          if (stoppingRef.current) {
            resetInFlight("idle");
            toast("Run cancelled.");
          }
        } else {
          const msg = e instanceof Error ? e.message : "Run failed";
          resetInFlight("error", msg);
          toast(msg, "error");
        }
      } finally {
        inflightRef.current.delete(ac);
        if (watchAbortRef.current === ac) watchAbortRef.current = null;
        if (!inflightRef.current.size) {
          stoppingRef.current = false;
          setRunning(false);
        }
      }
    },
    [applyRunEvent, resetInFlight],
  );
  useLayoutEffect(() => {
    attachRunRef.current = attachRun;
  });

  const run = useCallback(
    async (from?: string) => {
      stoppingRef.current = false;
      setRunCostUsd(null);
      setConsoleLines([]);
      const payload = {
        graph: {
          nodes: nodesRef.current.map((n) => ({
            id: n.id,
            position: n.position,
            data: n.data as NodeData,
          })),
          edges: edgesRef.current,
        },
        graphId,
        from,
        cached: outputsRef.current,
      };
      const targets = from
        ? downstreamIds(from, edgesRef.current)
        : nodesRef.current.map((n) => n.id);
      setNodes((ns) =>
        ns.map((n) =>
          targets.includes(n.id)
            ? {
                ...n,
                data: {
                  ...n.data,
                  runStatus: "queued" as const,
                  runError: undefined,
                  runUsage: undefined,
                  streamingText: undefined,
                },
              }
            : n,
        ),
      );
      setRunning(true);
      try {
        const res = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await readJson<{ runId?: string; error?: string }>(res);
        if (!res.ok || !j.runId) {
          throw new Error(
            typeof j.error === "string" ? j.error : `Run failed (${res.status})`,
          );
        }
        await attachRun(j.runId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Run failed";
        resetInFlight("error", msg, targets);
        toast(msg, "error");
        setRunning(false);
      }
    },
    [setNodes, graphId, resetInFlight, attachRun],
  );

  const stop = useCallback(() => {
    stoppingRef.current = true;
    const id = activeRunIdRef.current;
    watchAbortRef.current?.abort();
    for (const ac of inflightRef.current) ac.abort();
    if (id) {
      void fetch(`/api/runs/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      });
    }
  }, []);

  const onNodeDoubleClick = useCallback(
    (e: MouseEvent, n: FN) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button, label, video, audio"))
        return;
      run(n.id);
    },
    [run],
  );

  const openBook = useCallback(
    async (id: string) => {
      if (id === graphId || running) return;
      if (dirty) await save();
      router.push(`/w/${id}`);
    },
    [graphId, running, dirty, save, router],
  );

  const newBook = useCallback(async () => {
    if (running) return;
    if (dirty) await save();
    try {
      const res = await fetch("/api/graphs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Untitled", graph: starterGraph() }),
      });
      const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
      if (!res.ok || !j.graph?.id) throw new Error(j.error || "Create failed");
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t create workbook.", "error");
    }
  }, [running, dirty, save, router]);

  useEffect(() => {
    const onRunNode = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail;
      run(nodeId);
    };
    window.addEventListener("kun:run-node", onRunNode);
    return () => window.removeEventListener("kun:run-node", onRunNode);
  }, [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest("input, textarea, [contenteditable=true]");
      if (meta && e.key === "s") {
        e.preventDefault();
        if (!readOnly) save(true);
      }
      if (meta && e.key === "z" && !e.shiftKey && !typing) {
        e.preventDefault();
        const prev = historyRef.current.undo({
          nodes: nodesRef.current.map((n) => ({
            id: n.id,
            type: "flow",
            position: n.position,
            data: n.data,
          })),
          edges: edgesRef.current.map((ed) => ({
            id: ed.id,
            source: ed.source,
            sourceHandle: ed.sourceHandle ?? null,
            target: ed.target,
            targetHandle: ed.targetHandle ?? null,
          })),
        });
        if (prev) applyDoc(prev);
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey)) && !typing) {
        e.preventDefault();
        const next = historyRef.current.redo({
          nodes: nodesRef.current.map((n) => ({
            id: n.id,
            type: "flow",
            position: n.position,
            data: n.data,
          })),
          edges: edgesRef.current.map((ed) => ({
            id: ed.id,
            source: ed.source,
            sourceHandle: ed.sourceHandle ?? null,
            target: ed.target,
            targetHandle: ed.targetHandle ?? null,
          })),
        });
        if (next) applyDoc(next);
      }
      if (meta && e.key === "c" && !typing) {
        const selected = nodesRef.current.filter((n) => n.selected);
        if (!selected.length) return;
        const pack = toPortable(
          {
            nodes: nodesRef.current.map((n) => ({
              id: n.id,
              type: "flow",
              position: n.position,
              data: n.data,
            })),
            edges: edgesRef.current.map((ed) => ({
              id: ed.id,
              source: ed.source,
              sourceHandle: ed.sourceHandle ?? null,
              target: ed.target,
              targetHandle: ed.targetHandle ?? null,
            })),
          },
          { nodeIds: selected.map((n) => n.id) },
        );
        void navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
        toast("Copied nodes.", "ok");
      }
      if (meta && e.key === "v" && !typing && !readOnly) {
        void (async () => {
          const text = await navigator.clipboard.readText();
          const pack = parsePortable(text);
          if (!pack) return;
          snapshotNow();
          const incoming = remapPortable(pack, {
            x: 80 + Math.random() * 40,
            y: 80 + Math.random() * 40,
          });
          applyDoc({
            nodes: [
              ...nodesRef.current.map((n) => ({
                id: n.id,
                type: "flow" as const,
                position: n.position,
                data: n.data,
              })),
              ...incoming.nodes,
            ],
            edges: [
              ...edgesRef.current.map((ed) => ({
                id: ed.id,
                source: ed.source,
                sourceHandle: ed.sourceHandle ?? null,
                target: ed.target,
                targetHandle: ed.targetHandle ?? null,
              })),
              ...incoming.edges,
            ],
          });
          toast("Pasted nodes.", "ok");
        })();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, applyDoc, snapshotNow, readOnly]);

  const statusOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of nodes) m[n.id] = n.data.runStatus ?? "idle";
    return m;
  }, [nodes]);

  // Wires take the colour of the data they carry; live ones animate.
  const kindOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of nodes) m[n.id] = n.data.kind;
    return m;
  }, [nodes]);

  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const type = portDef(kindOf[e.source] ?? "", e.sourceHandle ?? "", "out")?.type;
        const styled = type
          ? { ...e, style: { ...e.style, stroke: PORT_COLOR[type] } }
          : e;
        return statusOf[e.source] === "running" || statusOf[e.target] === "running"
          ? { ...styled, className: "kun-edge-live" }
          : styled;
      }),
    [edges, statusOf, kindOf],
  );

  // The right dock holds one panel at a time.
  const toggleAssistant = () => {
    const next = !showAssistant;
    setShowAssistant(next);
    if (next && showRuns) {
      setShowRuns(false);
      syncPanelFlag("runs", false);
    }
  };
  const toggleRuns = () => {
    const next = !showRuns;
    setShowRuns(next);
    syncPanelFlag("runs", next);
    if (next && showAssistant) setShowAssistant(false);
  };

  if (missing) {
    return (
      <StatusScreen
        kicker="404"
        title="This workbook isn’t here"
        body="It may have been deleted, or the link is out of date."
        action={
          <Link
            href={readOnly ? "/" : APP_HOME}
            className="kun-btn-primary inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium"
          >
            {readOnly ? "Go to Kun" : "Back to workbooks"}
          </Link>
        }
      />
    );
  }

  return (
    <ModelCatalogProvider value={catalog}>
      <div className="flex h-dvh w-full flex-col bg-canvas">
        <PlayBar
          readOnly={readOnly}
          runsOpen={showRuns}
          onRuns={readOnly ? undefined : toggleRuns}
          title={title}
          onTitle={(t: string) => {
            setTitle(t);
            touch();
          }}
          running={running}
          onRun={() => run()}
          onStop={stop}
          onSave={() => save(true)}
          saved={saved}
          dirty={dirty}
          costLabel={fmtUsd(runCostUsd)}
          books={books}
          activeId={graphId}
          onOpen={(id) => openBook(id)}
          onNew={() => newBook()}
          onSettings={() => settingsApi.setShowSettings(true)}
          assistantOpen={showAssistant}
          onAssistant={readOnly ? undefined : toggleAssistant}
          onPublish={readOnly ? undefined : () => setShowPublish(true)}
          onShare={
            readOnly
              ? undefined
              : async () => {
                  try {
                    const res = await fetch(`/api/graphs/${graphId}/share`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ permission: "view" }),
                    });
                    const j = await readJson<{ url?: string; error?: string }>(res);
                    if (!res.ok || !j.url) throw new Error(j.error || "Share failed");
                    const url = `${window.location.origin}${j.url}`;
                    await navigator.clipboard.writeText(url);
                    toast("Share link copied.", "ok");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Share failed", "error");
                  }
                }
          }
        />
        <div className="relative flex min-h-0 flex-1">
        <div
          className="relative min-w-0 flex-1"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow<FN>
            nodes={nodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            onNodesChange={(c) => {
              if (readOnly) return;
              // Keyboard deletion (Backspace/Delete) gets the same undo toast
              // as the header × button.
              if (c.some((ch) => ch.type === "remove")) {
                snapshotNow();
                toast("Node deleted.", "info", {
                  label: "Undo",
                  onClick: () => {
                    const prev = historyRef.current.undo({
                      nodes: nodesRef.current.map((n) => ({
                        id: n.id,
                        type: "flow",
                        position: n.position,
                        data: n.data,
                      })),
                      edges: edgesRef.current.map((ed) => ({
                        id: ed.id,
                        source: ed.source,
                        sourceHandle: ed.sourceHandle ?? null,
                        target: ed.target,
                        targetHandle: ed.targetHandle ?? null,
                      })),
                    });
                    if (prev) applyDoc(prev);
                  },
                });
              }
              onNodesChange(c);
              if (c.some((ch) => ch.type === "position" || ch.type === "remove"))
                touch();
            }}
            onEdgesChange={(c) => {
              if (readOnly) return;
              onEdgesChange(c);
              if (c.some((ch) => ch.type === "remove")) touch();
            }}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            connectionRadius={34}
            onNodeDoubleClick={onNodeDoubleClick}
            defaultEdgeOptions={{ type: "smoothstep" }}
            fitView
            fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
            minZoom={0.05}
            maxZoom={4}
            colorMode={theme.resolved}
            zoomOnDoubleClick={false}
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.3}
              color={theme.resolved === "light" ? "#d3d3cc" : "#1d2124"}
            />
            {showMini && (
              <MiniMap
                pannable
                zoomable
                position="top-right"
                maskColor={
                  theme.resolved === "light"
                    ? "rgba(242, 242, 239, 0.75)"
                    : "rgba(10, 11, 12, 0.75)"
                }
                style={{
                  background: theme.resolved === "light" ? "#ffffff" : "#111315",
                  border: `1px solid ${
                    theme.resolved === "light" ? "#dcdcd6" : "#31373b"
                  }`,
                  borderRadius: 12,
                  marginTop: 12,
                  marginRight: 12,
                  width: 168,
                  height: 112,
                }}
              />
            )}
            <Panel position="bottom-left">
              <CanvasToolbar
                onArrange={arrange}
                readOnly={readOnly}
                minimap={showMini}
                onToggleMinimap={() => {
                  const next = !showMini;
                  setShowMini(next);
                  syncPanelFlag("mini", next);
                }}
              />
            </Panel>
            {ready && nodes.length === 0 && (
              <Panel position="top-center">
                <div className="kun-pop rounded-full border border-line2 bg-raised/95 px-5 py-2 text-[13px] text-muted shadow-lg backdrop-blur">
                  {readOnly
                    ? "This workbook is empty."
                    : "Empty workbook. Add a node from the library, or ask the assistant."}
                </div>
              </Panel>
            )}
          </ReactFlow>
          {!readOnly && (
            <Palette
              onAdd={addNode}
              defs={NODE_TYPES}
              emptyCanvas={ready && nodes.length === 0}
            />
          )}
          <div className="absolute bottom-3 right-3 z-10 hidden w-[min(380px,calc(100%-336px))] min-w-[220px] md:block">
            <MiniConsole
              lines={consoleLines}
              runId={activeRunId}
              costUsd={runCostUsd}
              collapsed={consoleCollapsed}
              onToggle={() => setConsoleCollapsed((v) => !v)}
            />
          </div>
        </div>

        {showAssistant && !readOnly && (
          <AssistantPanel
            graphId={graphId}
            selectedNodeIds={nodes.filter((n) => n.selected).map((n) => n.id)}
            graph={{
              nodes: nodes.map((n) => ({
                id: n.id,
                type: "flow",
                position: n.position,
                data: n.data,
              })),
              edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle ?? null,
                target: e.target,
                targetHandle: e.targetHandle ?? null,
              })),
            }}
            onApply={(next: GraphDoc) => {
              setNodes(
                next.nodes.map(
                  (n) =>
                    ({
                      id: n.id,
                      type: "flow",
                      position: n.position,
                      data: n.data,
                    }) as FN,
                ),
              );
              setEdges(next.edges.map((e) => ({ ...e, type: "smoothstep" })));
              touch();
            }}
            onClose={() => setShowAssistant(false)}
          />
        )}
        {showRuns && !readOnly && (
          <aside
            aria-label="Run history"
            className="kun-pop z-30 flex min-h-0 w-[388px] shrink-0 flex-col border-l border-line bg-card max-md:absolute max-md:inset-0 max-md:w-full max-md:border-l-0"
          >
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-line pl-4 pr-3">
              <p className="text-[13.5px] font-medium text-ink">Run history</p>
              <div className="flex items-center gap-1">
                <Link
                  href={`/runs?graphId=${graphId}`}
                  className="rounded-full px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-ink/8 hover:text-ink"
                >
                  All runs
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowRuns(false);
                    syncPanelFlag("runs", false);
                  }}
                  aria-label="Close run history"
                  title="Close run history"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink"
                >
                  <X size={14} weight="bold" aria-hidden />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              <RunsPanel graphId={graphId} refreshKey={runsTick} />
            </div>
          </aside>
        )}
        </div>

        {(settingsApi.showSettings || settingsApi.needsOnboard) && (
          <SettingsModal
            env={settingsApi.env}
            onboarding={settingsApi.needsOnboard && !settingsApi.showSettings}
            onClose={settingsApi.dismissOnboard}
          />
        )}
        {showPublish && (
          <PublishTemplate
            graphId={graphId}
            title={title}
            onClose={() => setShowPublish(false)}
          />
        )}
      </div>
    </ModelCatalogProvider>
  );
}
