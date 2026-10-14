import { DEFAULT_TEXT_MODEL } from "./models";
import type { GraphDoc } from "./types";

export function emptyGraph(): GraphDoc {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

/** Seed graph shown in a brand-new project. */
export function starterGraph(): GraphDoc {
  const b = Date.now().toString(36);
  return {
    nodes: [
      {
        id: `t${b}`,
        type: "flow",
        position: { x: 60, y: 150 },
        data: {
          kind: "text",
          label: "Text",
          text: "Paste an article here, then hit Run.",
        },
      },
      {
        id: `l${b}`,
        type: "flow",
        position: { x: 400, y: 140 },
        data: {
          kind: "llm",
          label: "AI Text",
          model: DEFAULT_TEXT_MODEL,
          prompt: "Summarize the following article in 5 bullet points:",
        },
      },
    ],
    edges: [
      {
        id: `e1${b}`,
        source: `t${b}`,
        sourceHandle: "out",
        target: `l${b}`,
        targetHandle: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
