import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { graphs, savedShares, shares } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Projects other people shared with me. Only links that still work are
 * listed: a revoked or expired link, or a deleted project, drops off.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const rows = await db
      .select({
        id: savedShares.id,
        token: savedShares.token,
        title: graphs.title,
        ownerName: savedShares.ownerName,
        lastOpenedAt: savedShares.lastOpenedAt,
        permission: shares.permission,
        graph: graphs.graph,
      })
      .from(savedShares)
      .innerJoin(shares, eq(shares.token, savedShares.token))
      .innerJoin(graphs, eq(graphs.id, savedShares.graphId))
      .where(
        and(
          eq(savedShares.userId, actor.user.id),
          or(isNull(shares.expiresAt), gt(shares.expiresAt, new Date())),
        ),
      )
      .orderBy(desc(savedShares.lastOpenedAt))
      .limit(100);
    return NextResponse.json({
      shared: rows.map(({ graph, ...r }) => {
        const nodes = Array.isArray((graph as { nodes?: unknown[] })?.nodes)
          ? ((graph as { nodes: { data?: { kind?: string; artifactId?: string; outputs?: { type: string; artifactId?: string }[] } }[] }).nodes)
          : [];
        const kinds = [...new Set(nodes.map((n) => n.data?.kind).filter((k): k is string => !!k))];
        // The first picture the project shows, as its cover.
        let coverId: string | null = null;
        for (const n of nodes) {
          const hit = n.data?.outputs?.find((o) => o.type === "image" && o.artifactId);
          if (hit?.artifactId) {
            coverId = hit.artifactId;
            break;
          }
        }
        return { ...r, kinds, coverId };
      }),
    });
  } catch (e) {
    return fail(e);
  }
}

/** Take a project off my shared list (the link itself keeps working). */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db
      .delete(savedShares)
      .where(and(eq(savedShares.id, id), eq(savedShares.userId, actor.user.id)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
