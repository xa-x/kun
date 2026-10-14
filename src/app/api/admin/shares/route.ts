import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { graphs, organizations, shares } from "@/db/schema";
import { fail } from "@/lib/auth";
import { audit, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

/** Public links that currently work. */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const rows = await db
      .select({ s: shares, project: graphs.title, org: organizations.name })
      .from(shares)
      .innerJoin(graphs, eq(graphs.id, shares.graphId))
      .leftJoin(organizations, eq(organizations.id, shares.orgId))
      .where(or(isNull(shares.expiresAt), gt(shares.expiresAt, new Date())))
      .orderBy(desc(shares.createdAt))
      .limit(200);
    return NextResponse.json({
      shares: rows.map(({ s, project, org }) => ({
        id: s.id,
        token: s.token,
        permission: s.permission,
        project,
        workspace: org ?? "—",
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

/** Turn a link off. */
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const [row] = await db.select().from(shares).where(eq(shares.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: "Link not found." }, { status: 404 });
    await db.delete(shares).where(and(eq(shares.id, id)));
    await audit(gate.actor, "share.revoke", { type: "share", id }, { graphId: row.graphId, orgId: row.orgId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
