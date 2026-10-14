import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { callMcpTool, MCP_TOOLS } from "@/lib/mcp";
import { planOf } from "@/lib/billing";
import { handleRpc, isRpc } from "@/lib/mcp-rpc";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // This server answers requests directly; it has no event stream to offer.
  if (req.headers.get("accept")?.includes("text/event-stream")) {
    return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
  }
  try {
    const actor = await requireActor(req);
    if (!planOf(actor.org.plan).mcp) {
      return NextResponse.json({ error: "MCP is available on Pro and Team." }, { status: 402 });
    }
    return NextResponse.json({
      name: "kun",
      version: "0.1.0",
      tools: MCP_TOOLS,
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!planOf(actor.org.plan).mcp) {
      return NextResponse.json({ error: "MCP is available on Pro and Team." }, { status: 402 });
    }
    const body = await req.json().catch(() => ({}));

    // The Model Context Protocol proper: JSON-RPC 2.0, as agent clients speak it.
    if (isRpc(body)) {
      const ctx = {
        tools: MCP_TOOLS,
        call: (name: string, args: Record<string, unknown>) => callMcpTool(actor, name, args),
      };
      if (Array.isArray(body)) {
        const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean);
        return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
      }
      const res = await handleRpc(body, ctx);
      return res ? NextResponse.json(res) : new NextResponse(null, { status: 202 });
    }

    // The older plain request shape, kept for anything already calling it.
    const method = String(body.method ?? body.name ?? "");
    if (method === "tools/list" || method === "list") {
      return NextResponse.json({ tools: MCP_TOOLS });
    }
    const name = String(body.params?.name ?? body.tool ?? method);
    const args = (body.params?.arguments ?? body.arguments ?? body.params ?? {}) as Record<
      string,
      unknown
    >;
    const result = await callMcpTool(actor, name.replace(/^tools\/call:?/, ""), args);
    return NextResponse.json({ result });
  } catch (e) {
    return fail(e);
  }
}
