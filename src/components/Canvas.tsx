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
import { intlTag, useI18n } from "@/lib/i18n";
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
  getNodesBounds,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type IsValidConnection,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  isRunnableKind,
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
import { kindForNode, suggestionsFor } from "@/lib/models";
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
import { AutomatePanel } from "./AutomatePanel";
import { inputNames } from "@/lib/run-inputs";
import { FlowNode } from "./FlowNode";
import { DND_MIME } from "./Palette";
import { NODE_KEYS, NodeToolbar } from "./NodeToolbar";
import { PortPicker, type PortPick } from "./PortPicker";
import {
  frameAround,
  frameAt,
  membersOf,
  moveMembers,
  refitGroups,
} from "@/lib/groups";
import { PlayBar } from "./PlayBar";
import { CanvasToolbar } from "./CanvasToolbar";
import { PORT_COLOR } from "./node/tokens";
import { APP_HOME } from "@/lib/routes";
import { RunsPanel } from "./RunsPanel";
import { SettingsModal } from "./SettingsModal";
import { upgradeGraph } from "@/lib/upgrade";
import { persistableData, settleStatus } from "@/lib/graph";
import { readableViewport } from "@/lib/viewport";
import {
  CONFIRM_COST_USD,
  estimateRun,
  formatRunEstimate,
  type RunScope,
} from "@/lib/run-estimate";
import { loadEstimates, peekEstimate } from "@/lib/use-estimates";
import { Modal } from "./ui/Modal";
import { StatusScreen } from "./StatusScreen";
import { MiniConsole, type ConsoleLine } from "./MiniConsole";
import { PublishTemplate } from "./PublishTemplate";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { useTheme } from "./ThemeProvider";

type FN = Node<FlowNodeData, "flow">;

const nodeTypes = { flow: FlowNode };

/** Where an image, video or speech node reads its prompt. */
const MEDIA_PROMPT_PORT: Record<string, string> = {
  "image.gen": "prompt",
  "video.gen": "prompt",
  tts: "text",
};

/** The size a node occupies, measured once rendered, else a typical card. */
const sizeOf = (n: { measured?: { width?: number; height?: number }; width?: number; height?: number; data: { kind: string; w?: number; h?: number } }) => ({
  w: n.measured?.width ?? n.width ?? (n.data.kind === "group" ? (n.data.w ?? 420) : 276),
  h: n.measured?.height ?? n.height ?? (n.data.kind === "group" ? (n.data.h ?? 300) : 220),
});

/**
 * A saved node as React Flow wants it. Group frames carry their size and sit
 * behind the nodes they hold.
 */
function toFlowNode(n: {
  id: string;
  position: { x: number; y: number };
  data: NodeData | FlowNodeData;
}): FN {
  const isGroup = n.data.kind === "group";
  return {
    id: n.id,
    type: "flow",
    position: n.position,
    data: n.data as FlowNodeData,
    ...(isGroup
      ? {
          style: { width: n.data.w ?? 420, height: n.data.h ?? 300 },
          zIndex: -1,
        }
      : {}),
  } as FN;
}

export function Canvas({
  graphId,
  startAssistant = false,
  startPrompt,
  startRuns = false,
  startMini = false,
  shareToken,
  readOnly = false,
}: {
  graphId: string;
  startAssistant?: boolean;
  /** Sent to the assistant once, when the editor opens from a first-run prompt. */
  startPrompt?: string;
  startRuns?: boolean;
  startMini?: boolean;
  shareToken?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState<FN>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [title, setTitle] = useState("Untitled");
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showMini, setShowMini] = useState(startMini);
  const [showRuns, setShowRuns] = useState(startRuns);
  const [showAssistant, setShowAssistant] = useState(startAssistant);
  const [showAutomate, setShowAutomate] = useState(false);
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
        suggestionsFor(catalog, need, nodeDef(kind)?.models),
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

  // Opens the view where text is readable (see lib/viewport.ts).
  const showReadable = useCallback(
    (duration: number) => {
      const nodes = rf.getNodes();
      const el = document.querySelector(".react-flow");
      if (!nodes.length || !el) return;
      const { width, height } = el.getBoundingClientRect();
      rf.setViewport(readableViewport(getNodesBounds(nodes), { width, height }), {
        duration,
      });
    },
    [rf],
  );

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
        // Retired node kinds (Media Out, Skill) open as their replacements.
        const raw = {
          nodes: g.graph?.nodes ?? [],
          edges: g.graph?.edges ?? [],
        } as unknown as GraphDoc;
        const upgraded = upgradeGraph(raw);
        const loaded = upgraded.nodes.map((n) =>
          toFlowNode({ ...n, data: settleStatus(n.data) }),
        );
        setNodes(loaded);
        setEdges(
          (upgraded.edges as unknown as Edge[]).map((e) => ({
            ...e,
            type: "default",
          })),
        );
        outputsRef.current = Object.fromEntries(
          loaded
            .filter((n) => n.data.outputs?.length)
            .map((n) => [n.id, n.data.outputs as NodeOutput[]]),
        );
        // An upgraded graph differs from what is stored; save it back on the
        // next autosave, but never write from a read-only share link.
        setDirty(upgraded !== raw && !readOnly);
        setReady(true);
        // A saved view wins, unless it is the unreadable overview an earlier
        // auto-fit saved (below 45%).
        const viewport = g.graph?.viewport;
        if (viewport && viewport.zoom >= 0.45)
          setTimeout(() => rf.setViewport(viewport, { duration: 0 }), 80);
        else setTimeout(() => showReadable(0), 160);
      } catch {
        if (alive) {
          toast(t("canvas.canvas.loadFailed"), "error");
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
            startedAt?: string | null;
            durationMs?: number | null;
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
                runStartedAt:
                  row.status === "running" && row.startedAt
                    ? Date.parse(row.startedAt)
                    : undefined,
                runDurationMs: row.durationMs ?? undefined,
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
        data: persistableData(n.data) as FlowNodeData,
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
        if (!res.ok) throw new Error(t("canvas.canvas.saveFailed"));
        setDirty(false);
        setSaved(new Date().toLocaleTimeString(intlTag(locale)));
        refreshBooks();
        if (manual) setTimeout(() => setSaved(null), 2000);
      } catch (e) {
        toast(e instanceof Error ? e.message : t("canvas.canvas.saveFailed"), "error");
      }
    },
    [graphId, title, doc, refreshBooks, t],
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
      setNodes(next.nodes.map((n) => toFlowNode(n)));
      setEdges(next.edges.map((e) => ({ ...e, type: "default" })));
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
    // Only runnable nodes are laid out; notes and frames keep their place, and
    // each frame is then re-fitted around what is inside it.
    const all = nodesRef.current;
    const runnable = all.filter((n) => isRunnableKind(n.data.kind));
    const ids = new Set(runnable.map((n) => n.id));
    const laid = layoutGraph({
      nodes: runnable.map((n) => ({
        id: n.id,
        type: "flow",
        position: n.position,
        data: n.data,
      })),
      edges: edgesRef.current
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => ({
          id: e.id,
          source: e.source,
          sourceHandle: e.sourceHandle ?? null,
          target: e.target,
          targetHandle: e.targetHandle ?? null,
        })),
    });
    const sizes = new Map(all.map((n) => [n.id, sizeOf(n)]));
    const notes = all
      .filter((n) => !isRunnableKind(n.data.kind))
      .map((n) => ({ id: n.id, type: "flow", position: n.position, data: n.data }));
    const fitted = refitGroups(
      [...notes, ...laid.nodes],
      (n) => sizes.get(n.id) ?? { w: 276, h: 220 },
    );
    applyDoc({ ...laid, nodes: fitted });
    requestAnimationFrame(() => showReadable(400));
  }, [applyDoc, snapshotNow, showReadable]);

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
      const { nodeId, artifactId, mediaType } = (e as CustomEvent).detail;
      setNodes((ns) =>
        ns.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, artifactId, ...(mediaType ? { mediaType } : {}) } }
            : n,
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
      toast(t("canvas.canvas.nodeDeleted"), "info", {
        label: t("canvas.canvas.undo"),
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
    window.addEventListener("kun:update", onUpdate);
    window.addEventListener("kun:set-artifact", onArtifact);
    window.addEventListener("kun:remove-node", onRemove);
    window.addEventListener("kun:duplicate-node", onDuplicate);
    return () => {
      window.removeEventListener("kun:update", onUpdate);
      window.removeEventListener("kun:set-artifact", onArtifact);
      window.removeEventListener("kun:remove-node", onRemove);
      window.removeEventListener("kun:duplicate-node", onDuplicate);
    };
  }, [setNodes, setEdges, touch, t, readOnly, snapshotNow, applyDoc]);

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
          .map((e) => ({ ...e, type: "default" })),
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
      // Image, video and speech nodes have no text box of their own: they take
      // their prompt from a wire. Arrive with a Prompt node already connected.
      const promptPort = MEDIA_PROMPT_PORT[type];
      const promptId = `${id}-prompt`;
      setNodes((ns) => [
        ...ns,
        ...(promptPort
          ? [
              toFlowNode({
                id: promptId,
                position: { x: x - 340, y },
                data: { kind: "text", label: "Prompt", text: "" },
              }),
            ]
          : []),
        {
          id,
          type: "flow",
          position: { x, y },
          data: {
            kind: type,
            label: def.label,
            ...(def.category === "ai" ? defaultModelFor(type) : {}),
            ...(type === "comment" ? { tone: "sand" as const } : {}),
          },
        },
      ]);
      if (promptPort)
        setEdges((es) => [
          ...es,
          {
            id: `e-${promptId}`,
            source: promptId,
            sourceHandle: "out",
            target: id,
            targetHandle: promptPort,
            type: "default",
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

  // --- groups -----------------------------------------------------------------
  // A frame drawn behind some nodes. What is inside moves with it and can be run
  // apart from the rest (Run group). Membership lives on the nodes (`data.group`).
  const groupSelection = useCallback(() => {
    if (readOnly) return;
    const picked = nodesRef.current.filter(
      (n) => n.selected && n.data.kind !== "group",
    );
    if (!picked.length) {
      toast(t("canvas.canvas.selectToGroup"), "info");
      return;
    }
    snapshotNow();
    const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;
    const f = frameAround(picked, sizeOf);
    const frame = toFlowNode({
      id,
      position: f.position,
      data: { kind: "group", label: "Group", tone: "sky", w: f.w, h: f.h },
    });
    const inside = new Set(picked.map((n) => n.id));
    setNodes((ns) => [
      frame,
      ...ns.map((n) =>
        inside.has(n.id)
          ? { ...n, selected: false, data: { ...n.data, group: id } }
          : n,
      ),
    ]);
    setDirty(true);
  }, [readOnly, snapshotNow, setNodes, t]);

  // --- adding from a port -----------------------------------------------------
  // An open port offers the nodes that can connect to it; picking one adds it
  // beside the port and wires them together.
  const [portPick, setPortPick] = useState<PortPick | null>(null);
  const addConnected = useCallback(
    (origin: PortPick, kind: string) => {
      if (readOnly) return;
      const from = nodesRef.current.find((n) => n.id === origin.nodeId);
      const def = nodeDef(kind);
      if (!from || !def) return;
      const wire =
        origin.side === "out"
          ? matchPorts(from.data.kind, kind, origin.handle, null)
          : matchPorts(kind, from.data.kind, null, origin.handle);
      if (!wire) {
        toast(t("canvas.canvas.cantConnect"), "info");
        return;
      }
      const size = sizeOf(from);
      const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const position =
        origin.side === "out"
          ? { x: from.position.x + size.w + 100, y: from.position.y }
          : { x: from.position.x - 340, y: from.position.y };
      const node = toFlowNode({
        id,
        position,
        data: {
          kind,
          label: def.label,
          ...(def.category === "ai" ? defaultModelFor(kind) : {}),
        },
      });
      // A media node brings its own Prompt node, unless this very wire is its prompt.
      const promptPort = MEDIA_PROMPT_PORT[kind];
      const wiresPrompt = origin.side === "out" && wire.targetHandle === promptPort;
      const promptId = `${id}-prompt`;
      snapshotNow();
      setNodes((ns) => [
        ...ns,
        ...(promptPort && !wiresPrompt
          ? [
              toFlowNode({
                id: promptId,
                position: { x: position.x - 340, y: position.y + 120 },
                data: { kind: "text", label: "Prompt", text: "" },
              }),
            ]
          : []),
        node,
      ]);
      setEdges((es) => [
        ...es,
        {
          id: `e${id}`,
          source: origin.side === "out" ? origin.nodeId : id,
          sourceHandle: wire.sourceHandle,
          target: origin.side === "out" ? id : origin.nodeId,
          targetHandle: wire.targetHandle,
          type: "default",
        },
        ...(promptPort && !wiresPrompt
          ? [
              {
                id: `e-${promptId}`,
                source: promptId,
                sourceHandle: "out",
                target: id,
                targetHandle: promptPort,
                type: "default",
              },
            ]
          : []),
      ]);
      setDirty(true);
      setPortPick(null);
    },
    [readOnly, snapshotNow, setNodes, setEdges, defaultModelFor, t],
  );

  useEffect(() => {
    const onPortAdd = (e: Event) => {
      if (readOnly) return;
      const d = (e as CustomEvent).detail as {
        nodeId: string;
        handle: string;
        side: "out" | "in";
        type: PortPick["type"];
        x: number;
        y: number;
      };
      setPortPick({ ...d });
    };
    window.addEventListener("kun:port-add", onPortAdd);
    return () => window.removeEventListener("kun:port-add", onPortAdd);
  }, [readOnly]);

  // Dropping a wire on empty canvas asks what to connect it to.
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      if (readOnly || state.isValid || state.toNode) return;
      const { fromNode, fromHandle } = state;
      if (!fromNode || !fromHandle?.id) return;
      const side = fromHandle.type === "source" ? "out" : "in";
      const def = nodeDef((fromNode.data as { kind: string }).kind);
      const port = (side === "out" ? def?.outputs : def?.inputs)?.find(
        (p) => p.id === fromHandle.id,
      );
      if (!port) return;
      const pt = "changedTouches" in event ? event.changedTouches[0] : event;
      setPortPick({
        nodeId: fromNode.id,
        handle: port.id,
        side,
        type: port.type,
        x: pt.clientX,
        y: pt.clientY,
      });
    },
    [readOnly],
  );

  const dragFrom = useRef<{ id: string; x: number; y: number } | null>(null);
  const onNodeDragStart = useCallback((_: unknown, n: FN) => {
    dragFrom.current = { id: n.id, x: n.position.x, y: n.position.y };
  }, []);
  // Dragging a frame carries its nodes along (those selected with it are
  // already moving, so they are skipped).
  const onNodeDrag = useCallback(
    (_: unknown, n: FN) => {
      const from = dragFrom.current;
      if (!from || from.id !== n.id || n.data.kind !== "group") return;
      const dx = n.position.x - from.x;
      const dy = n.position.y - from.y;
      if (!dx && !dy) return;
      dragFrom.current = { id: n.id, x: n.position.x, y: n.position.y };
      const moving = new Set(
        nodesRef.current.filter((x) => x.selected).map((x) => x.id),
      );
      setNodes((ns) => moveMembers(ns, n.id, dx, dy, moving));
    },
    [setNodes],
  );
  // Dropping a node into or out of a frame changes what the frame holds.
  const onNodeDragStop = useCallback(
    (_: unknown, n: FN) => {
      dragFrom.current = null;
      if (n.data.kind === "group") return;
      const now = nodesRef.current.find((x) => x.id === n.id) ?? n;
      const next = frameAt(now, nodesRef.current, sizeOf);
      if (next === now.data.group) return;
      setNodes((ns) =>
        ns.map((x) =>
          x.id === n.id ? { ...x, data: { ...x.data, group: next } } : x,
        ),
      );
      setDirty(true);
    },
    [setNodes],
  );

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
                  // Stamp the start for the elapsed timer; on finish keep how
                  // long it took, to show beside the cost.
                  runStartedAt:
                    ev.status === "running" ? ev.ts : undefined,
                  runDurationMs:
                    ev.status === "done" && n.data.runStartedAt
                      ? ev.ts - n.data.runStartedAt
                      : ev.status === "running" || ev.status === "queued"
                        ? undefined
                        : n.data.runDurationMs,
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
            toast(t("canvas.canvas.runCancelled"));
          }
        } else {
          const msg = e instanceof Error ? e.message : t("canvas.canvas.runFailed");
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
    [applyRunEvent, resetInFlight, t],
  );
  useLayoutEffect(() => {
    attachRunRef.current = attachRun;
  });

  const run = useCallback(
    async (scope: RunScope = {}) => {
      const { only, from, nodes: groupIds } = scope;
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
        only,
        from,
        nodes: groupIds,
        cached: outputsRef.current,
      };
      const targetsAll = only
        ? [only]
        : groupIds?.length
          ? groupIds
          : from
            ? downstreamIds(from, edgesRef.current)
            : nodesRef.current
                .filter((n) => isRunnableKind(n.data.kind))
                .map((n) => n.id);
      // Frozen nodes are not run, so they are not queued either.
      const frozenIds = new Set(
        nodesRef.current.filter((n) => n.data.frozen).map((n) => n.id),
      );
      const targets = targetsAll.filter((id) => id === only || !frozenIds.has(id));
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
            typeof j.error === "string" ? j.error : t("canvas.canvas.runFailedStatus", { status: res.status }),
          );
        }
        await attachRun(j.runId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("canvas.canvas.runFailed");
        resetInFlight("error", msg, targets);
        toast(msg, "error");
        setRunning(false);
      }
    },
    [setNodes, graphId, resetInFlight, attachRun, t],
  );

  // --- cost and time before a run ------------------------------------------
  // Typical figures come from earlier runs (see /api/estimates). A run that is
  // expected to cost real money asks first; cheap runs go straight through.
  const modelOf = useCallback(
    (n: FN) => (n.data.model as string | undefined) || defaultModelFor(n.data.kind).model,
    [defaultModelFor],
  );
  const estimateFor = useCallback(
    (scope: RunScope) =>
      estimateRun({
        nodes: nodesRef.current,
        edges: edgesRef.current,
        scope,
        estimateOf: (id) => {
          const n = nodesRef.current.find((x) => x.id === id);
          return n ? peekEstimate(modelOf(n)) : null;
        },
      }),
    [modelOf],
  );
  const aiModels = useCallback(
    () =>
      nodesRef.current
        .filter((n) => nodeDef(n.data.kind)?.category === "ai")
        .map((n) => modelOf(n))
        .filter(Boolean),
    [modelOf],
  );

  const [runHint, setRunHint] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || running) return;
    let alive = true;
    const timer = setTimeout(async () => {
      await loadEstimates(aiModels());
      if (alive) setRunHint(formatRunEstimate(estimateFor({}), t));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, running, nodes, edges, aiModels, estimateFor]);

  const [confirmRun, setConfirmRun] = useState<{
    scope: RunScope;
    label: string;
  } | null>(null);
  const requestRun = useCallback(
    async (scope: RunScope = {}) => {
      await loadEstimates(aiModels());
      const est = estimateFor(scope);
      if (est.costUsd >= CONFIRM_COST_USD) {
        setConfirmRun({ scope, label: formatRunEstimate(est, t) ?? "" });
        return;
      }
      void run(scope);
    },
    [aiModels, estimateFor, run],
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
      requestRun({ only: n.id });
    },
    [requestRun],
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
      if (!res.ok || !j.graph?.id) throw new Error(j.error || t("canvas.canvas.createFailed"));
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("canvas.canvas.createProjectFailed"), "error");
    }
  }, [running, dirty, save, router, t]);

  useEffect(() => {
    const onRunNode = (e: Event) => {
      const { nodeId, mode } = (e as CustomEvent).detail as {
        nodeId: string;
        mode?: "only" | "from";
      };
      requestRun(mode === "from" ? { from: nodeId } : { only: nodeId });
    };
    window.addEventListener("kun:run-node", onRunNode);
    return () => window.removeEventListener("kun:run-node", onRunNode);
  }, [requestRun]);

  useEffect(() => {
    const onRunGroup = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      const ids = membersOf(nodesRef.current, nodeId)
        .filter((n) => isRunnableKind(n.data.kind))
        .map((n) => n.id);
      if (!ids.length) {
        toast(t("canvas.canvas.emptyGroup"), "info");
        return;
      }
      requestRun({ nodes: ids });
    };
    const onUngroup = (e: Event) => {
      if (readOnly) return;
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      snapshotNow();
      setNodes((ns) =>
        ns
          .filter((n) => n.id !== nodeId)
          .map((n) =>
            n.data.group === nodeId
              ? { ...n, data: { ...n.data, group: undefined } }
              : n,
          ),
      );
      setDirty(true);
    };
    window.addEventListener("kun:run-group", onRunGroup);
    window.addEventListener("kun:ungroup", onUngroup);
    return () => {
      window.removeEventListener("kun:run-group", onRunGroup);
      window.removeEventListener("kun:ungroup", onUngroup);
    };
  }, [requestRun, readOnly, snapshotNow, setNodes, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest(
        "input, textarea, select, [contenteditable=true], [role=textbox], [role=dialog]",
      );
      if (meta && e.key === "s") {
        e.preventDefault();
        if (!readOnly) save(true);
      }
      if (meta && e.key.toLowerCase() === "g" && !typing && !readOnly) {
        e.preventDefault();
        groupSelection();
      }
      // Bare keys: 1-8 and C add a node, V / Esc put the selection down.
      if (!meta && !e.altKey && !typing && !readOnly && !e.repeat) {
        const kind = NODE_KEYS[e.key.toLowerCase()];
        if (kind) {
          e.preventDefault();
          addNode(kind);
        } else if (e.key.toLowerCase() === "v" || e.key === "Escape") {
          setNodes((ns) =>
            ns.some((n) => n.selected)
              ? ns.map((n) => (n.selected ? { ...n, selected: false } : n))
              : ns,
          );
        }
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
        toast(t("canvas.canvas.copiedNodes"), "ok");
      }
      if (meta && e.key === "v" && !typing && !readOnly) {
        void (async () => {
          const text = await navigator.clipboard.readText();
          const pack = parsePortable(text);
          if (!pack) return;
          snapshotNow();
          // Pasted nodes get the same clean-up as an opened project.
          const incoming = upgradeGraph(
            remapPortable(pack, {
              x: 80 + Math.random() * 40,
              y: 80 + Math.random() * 40,
            }),
          );
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
          toast(t("canvas.canvas.pastedNodes"), "ok");
        })();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, applyDoc, snapshotNow, readOnly, groupSelection, addNode, setNodes, t]);

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
    if (next) {
      setShowAutomate(false);
      if (showRuns) {
        setShowRuns(false);
        syncPanelFlag("runs", false);
      }
    }
  };
  const toggleRuns = () => {
    const next = !showRuns;
    setShowRuns(next);
    syncPanelFlag("runs", next);
    if (next) {
      setShowAssistant(false);
      setShowAutomate(false);
    }
  };
  const toggleAutomate = () => {
    const next = !showAutomate;
    setShowAutomate(next);
    if (next) {
      setShowAssistant(false);
      if (showRuns) {
        setShowRuns(false);
        syncPanelFlag("runs", false);
      }
    }
  };

  if (missing) {
    return (
      <StatusScreen
        kicker="404"
        title={t("canvas.canvas.missingTitle")}
        body={t("canvas.canvas.missingBody")}
        action={
          <Link
            href={readOnly ? "/" : APP_HOME}
            className="kun-btn-primary inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium"
          >
            {readOnly ? t("canvas.canvas.goToKun") : t("canvas.canvas.backToProjects")}
          </Link>
        }
      />
    );
  }

  return (
    <ModelCatalogProvider value={catalog}>
      <div className="flex h-dvh w-full flex-col bg-canvas">
        <div className="relative flex min-h-0 flex-1">
        <div
          className="relative min-w-0 flex-1"
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <PlayBar
            readOnly={readOnly}
            runsOpen={showRuns}
            onRuns={readOnly ? undefined : toggleRuns}
            automateOpen={showAutomate}
            onAutomate={readOnly ? undefined : toggleAutomate}
            title={title}
            onTitle={(next: string) => {
              setTitle(next);
              touch();
            }}
            running={running}
            onRun={() => requestRun()}
            runHint={runHint}
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
                      if (!res.ok || !j.url) throw new Error(j.error || t("canvas.canvas.shareFailed"));
                      const url = `${window.location.origin}${j.url}`;
                      await navigator.clipboard.writeText(url);
                      toast(t("canvas.canvas.shareCopied"), "ok");
                    } catch (e) {
                      toast(e instanceof Error ? e.message : t("canvas.canvas.shareFailed"), "error");
                    }
                  }
            }
          />
          <ReactFlow<FN>
            proOptions={{ hideAttribution: true }}
            nodes={nodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            onNodesChange={(c) => {
              if (readOnly) return;
              // Keyboard deletion (Backspace/Delete) gets the same undo toast
              // as the header × button.
              if (c.some((ch) => ch.type === "remove")) {
                snapshotNow();
                toast(t("canvas.canvas.nodeDeleted"), "info", {
                  label: t("canvas.canvas.undo"),
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
            onConnectEnd={onConnectEnd}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            defaultEdgeOptions={{ type: "default" }}
            fitView
            fitViewOptions={{ padding: 0.22, maxZoom: 1, minZoom: 0.6 }}
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
                  marginTop: 76,
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
                    ? t("canvas.canvas.emptyReadOnly")
                    : t("canvas.canvas.emptyHint")}
                </div>
              </Panel>
            )}
          </ReactFlow>
          {!readOnly && (
            <NodeToolbar
              onAdd={addNode}
              onGroup={groupSelection}
              onSelect={() =>
                setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)))
              }
              selectedCount={
                nodes.filter((n) => n.selected && n.data.kind !== "group").length
              }
            />
          )}
          <div className="absolute bottom-3 end-3 z-10 hidden w-[min(380px,calc(100%-336px))] min-w-[220px] md:block">
            <MiniConsole
              lines={consoleLines}
              runId={activeRunId}
              costUsd={runCostUsd}
              collapsed={consoleCollapsed}
              onToggle={() => setConsoleCollapsed((v) => !v)}
            />
          </div>
        </div>

        {showAssistant && !readOnly && ready && (
          <AssistantPanel
            graphId={graphId}
            autoPrompt={startPrompt}
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
            onApply={(applied: GraphDoc) => {
              // The assistant may type a prompt into a media node; give it the
              // wired Text node the canvas expects.
              const next = upgradeGraph(applied);
              // Nodes the assistant adds to a canvas that was empty (or that
              // sit outside the view) must be brought into sight.
              const grew = next.nodes.length > nodesRef.current.length;
              if (grew) requestAnimationFrame(() => setTimeout(() => showReadable(400), 120));
              setNodes(next.nodes.map((n) => toFlowNode(n)));
              setEdges(next.edges.map((e) => ({ ...e, type: "default" })));
              touch();
            }}
            onClose={() => setShowAssistant(false)}
          />
        )}
        {showAutomate && !readOnly && ready && (
          <AutomatePanel
            graphId={graphId}
            inputNames={inputNames({ nodes: doc.nodes.map((n) => ({ ...n, type: "flow" })) })}
            saveFirst={() => save()}
            onClose={() => setShowAutomate(false)}
          />
        )}
        {showRuns && !readOnly && (
          <aside
            aria-label={t("canvas.canvas.runHistory")}
            className="kun-pop z-30 flex min-h-0 w-[388px] shrink-0 flex-col border-s border-line bg-card max-md:absolute max-md:inset-0 max-md:w-full max-md:border-s-0"
          >
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-line ps-4 pe-3">
              <p className="text-[13.5px] font-medium text-ink">{t("canvas.canvas.runHistory")}</p>
              <div className="flex items-center gap-1">
                <Link
                  href={`/runs?graphId=${graphId}`}
                  className="rounded-full px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:bg-ink/8 hover:text-ink"
                >
                  {t("canvas.canvas.allRuns")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowRuns(false);
                    syncPanelFlag("runs", false);
                  }}
                  aria-label={t("canvas.canvas.closeRunHistory")}
                  title={t("canvas.canvas.closeRunHistory")}
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
        {portPick && (
          <PortPicker
            pick={portPick}
            onPick={(kind) => addConnected(portPick, kind)}
            onClose={() => setPortPick(null)}
          />
        )}
        {confirmRun && (
          <Modal
            title={t("canvas.canvas.confirmTitle")}
            description={t("canvas.canvas.confirmDesc")}
            onClose={() => setConfirmRun(null)}
            footer={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRun(null)}
                  className="kun-btn-secondary h-10 rounded-full px-5 text-[13.5px] font-medium"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const scope = confirmRun.scope;
                    setConfirmRun(null);
                    void run(scope);
                  }}
                  className="kun-btn-primary h-10 rounded-full px-6 text-[13.5px] font-medium"
                >
                  {t("common.run")}
                </button>
              </div>
            }
          >
            <p className="font-mono text-[15px] text-ink">{confirmRun.label}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {t("canvas.canvas.confirmBody")}
            </p>
          </Modal>
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
