import { describe, expect, it, vi } from "vitest";
import { handleRpc, isRpc } from "./mcp-rpc";

const tools = [{ name: "list_workbooks", description: "List projects", inputSchema: { type: "object" } }];
const call = vi.fn(async (name: string) => (name === "list_workbooks" ? [{ id: "a" }] : null));
const ctx = { tools, call };

describe("handleRpc", () => {
  it("answers initialize with the version the client asked for", async () => {
    const r = await handleRpc(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } },
      ctx,
    );
    expect(r).toMatchObject({
      id: 1,
      result: { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "kun" } },
    });
  });

  it("falls back to the newest version for one it does not know", async () => {
    const r = await handleRpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999" } }, ctx);
    expect(r).toMatchObject({ result: { protocolVersion: "2025-06-18" } });
  });

  it("lists tools and calls one, returning the result as text content", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/list" }, ctx)).toMatchObject({
      result: { tools },
    });
    const r = await handleRpc(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_workbooks", arguments: {} } },
      ctx,
    );
    expect(r).toMatchObject({ id: 4, result: { isError: false } });
    const text = (r as { result: { content: { text: string }[] } }).result.content[0].text;
    expect(JSON.parse(text)).toEqual([{ id: "a" }]);
  });

  it("reports a tool that throws as a readable result, not a protocol error", async () => {
    const boom = { tools, call: async () => { throw new Error("Project not found"); } };
    const r = await handleRpc(
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_workbooks" } },
      boom,
    );
    expect(r).toMatchObject({
      result: { isError: true, content: [{ type: "text", text: "Project not found" }] },
    });
  });

  it("rejects an unknown tool or method with the right codes", async () => {
    expect(
      await handleRpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "nope" } }, ctx),
    ).toMatchObject({ error: { code: -32602 } });
    expect(await handleRpc({ jsonrpc: "2.0", id: 7, method: "resources/list" }, ctx)).toMatchObject({
      error: { code: -32601 },
    });
  });

  it("says nothing to a notification", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx)).toBeNull();
  });

  it("answers ping", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", id: 8, method: "ping" }, ctx)).toMatchObject({ result: {} });
  });
});

describe("isRpc", () => {
  it("tells JSON-RPC from the older plain request", () => {
    expect(isRpc({ jsonrpc: "2.0", method: "ping", id: 1 })).toBe(true);
    expect(isRpc([{ jsonrpc: "2.0" }])).toBe(true);
    expect(isRpc({ method: "tools/list" })).toBe(false);
  });
});
