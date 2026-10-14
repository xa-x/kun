import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, graphs, runs } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { assetName, parseKind, parseSource } from "@/lib/assets";

export const runtime = "nodejs";

const PAGE = 48;

/** The workspace's files: uploads, generated media and saved stock photos. */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const sp = req.nextUrl.searchParams;
    const kind = parseKind(sp.get("kind"));
    const source = parseSource(sp.get("source"));
    const q = (sp.get("q") ?? "").trim().slice(0, 60);
    const page = Math.min(PAGE, Math.max(1, Number(sp.get("limit")) || PAGE));
    const before = sp.get("before");
    const beforeDate = before ? new Date(before) : null;

    const where = and(
      eq(artifacts.orgId, actor.org.id),
      kind ? eq(artifacts.kind, kind) : undefined,
      source ? eq(artifacts.source, source) : undefined,
      q ? ilike(sql`${artifacts.meta}->>'name'`, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
      beforeDate && !Number.isNaN(beforeDate.getTime()) ? lt(artifacts.createdAt, beforeDate) : undefined,
    );
    const rows = await db
      .select({
        a: artifacts,
        graphId: runs.graphId,
        graphTitle: graphs.title,
      })
      .from(artifacts)
      .leftJoin(runs, eq(runs.id, artifacts.runId))
      .leftJoin(graphs, eq(graphs.id, runs.graphId))
      .where(where)
      .orderBy(desc(artifacts.createdAt))
      .limit(page + 1);

    const shown = rows.slice(0, page);
    return NextResponse.json({
      assets: shown.map(({ a, graphId, graphTitle }) => ({
        id: a.id,
        kind: a.kind,
        mimeType: a.mimeType,
        bytes: a.bytes,
        source: a.source,
        name: assetName(a),
        url: `/api/media/${a.id}`,
        createdAt: a.createdAt,
        project: graphId ? { id: graphId, title: graphTitle ?? "Untitled" } : null,
        credit:
          a.source === "stock" && a.meta && typeof a.meta === "object"
            ? {
                by: String((a.meta as { photographer?: string }).photographer ?? ""),
                url: String((a.meta as { photographerUrl?: string }).photographerUrl ?? ""),
                page: String((a.meta as { pageUrl?: string }).pageUrl ?? ""),
              }
            : null,
      })),
      next: rows.length > page ? shown[shown.length - 1].a.createdAt : null,
    });
  } catch (e) {
    return fail(e);
  }
}
