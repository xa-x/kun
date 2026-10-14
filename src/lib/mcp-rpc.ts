/**
 * The Model Context Protocol over HTTP: JSON-RPC 2.0 messages in, one JSON
 * message out (or nothing for a notification). Enough of the protocol for an
 * agent client to connect, list Kun's tools and call them.
 */

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: unknown;
}

type Id = string | number | null;

interface Message {
  jsonrpc?: string;
  id?: Id;
  method?: string;
  params?: Record<string, unknown>;
}

export type RpcResponse =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string } };

const fail = (id: Id, code: number, message: string): RpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

/** Does this body look like JSON-RPC, as opposed to the older plain request? */
export const isRpc = (body: unknown): boolean =>
  Array.isArray(body) ||
  (typeof body === "object" && body !== null && (body as Message).jsonrpc === "2.0");

export async function handleRpc(
  msg: unknown,
  ctx: { tools: readonly ToolDef[]; call: (name: string, args: Record<string, unknown>) => Promise<unknown> },
): Promise<RpcResponse | null> {
  if (typeof msg !== "object" || msg === null) return fail(null, -32600, "Invalid request");
  const m = msg as Message;
  const id = m.id ?? null;
  const isNotification = m.id === undefined;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string")
    return isNotification ? null : fail(id, -32600, "Invalid request");

  switch (m.method) {
    case "initialize": {
      const asked = typeof m.params?.protocolVersion === "string" ? m.params.protocolVersion : "";
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "kun", version: "0.1.0" },
          instructions:
            "Kun runs projects: pipelines of text, image, speech and video models. List projects, set a project's inputs, run it, then read the run's status and result.",
        },
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: ctx.tools } };
    case "tools/call": {
      const name = typeof m.params?.name === "string" ? m.params.name : "";
      if (!ctx.tools.some((t) => t.name === name))
        return fail(id, -32602, `Unknown tool: ${name || "(none)"}`);
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await ctx.call(name, args);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(out ?? null, null, 2) }],
            isError: false,
          },
        };
      } catch (e) {
        // A tool that fails is a result the model can read, not a protocol error.
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: e instanceof Error ? e.message : "The tool failed." }],
            isError: true,
          },
        };
      }
    }
    default:
      // "notifications/initialized" and friends need no answer.
      if (isNotification || m.method.startsWith("notifications/")) return null;
      return fail(id, -32601, `Method not found: ${m.method}`);
  }
}
