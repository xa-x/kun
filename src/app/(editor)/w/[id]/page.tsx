import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/components/Canvas";

// Server component: awaiting params here keeps `use()` out of the client
// bundle — a client page suspending on params can hang the route's loading
// boundary forever on a hard load.
export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    assistant?: string;
    runs?: string;
    mini?: string;
    prompt?: string;
  }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  return (
    <ReactFlowProvider>
      <Canvas
        key={id}
        graphId={id}
        startAssistant={q.assistant === "1"}
        startPrompt={q.assistant === "1" ? q.prompt?.slice(0, 600) : undefined}
        startRuns={q.runs === "1"}
        startMini={q.mini === "1"}
      />
    </ReactFlowProvider>
  );
}
