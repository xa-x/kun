import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, graphs } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canEdit } from "@/lib/tenant";
import { objectStore } from "@/lib/storage";

export const runtime = "nodejs";

async function ownAsset(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/** Projects that currently use this file (in an input or a saved result). */
async function usedIn(orgId: string, id: string) {
  return db
    .select({ id: graphs.id, title: graphs.title })
    .from(graphs)
    .where(and(eq(graphs.orgId, orgId), sql`${graphs.graph}::text like ${`%"${id}"%`}`))
    .limit(20);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { id } = await params;
    if (!(await ownAsset(actor.org.id, id))) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ usedIn: await usedIn(actor.org.id, id) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    if (!canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const row = await ownAsset(actor.org.id, id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Give it a name." }, { status: 400 });
    const meta = { ...((row.meta as Record<string, unknown> | null) ?? {}), name };
    await db.update(artifacts).set({ meta }).where(eq(artifacts.id, id));
    return NextResponse.json({ id, name });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(req);
    if (!canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const row = await ownAsset(actor.org.id, id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    await db.delete(artifacts).where(eq(artifacts.id, id));
    await objectStore.remove(row.filename).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
