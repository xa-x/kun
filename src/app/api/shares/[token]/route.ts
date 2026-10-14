import { NextRequest, NextResponse } from "next/server";
import { assertCanCreateProject } from "@/lib/limits";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { graphs, savedShares, shares, users } from "@/db/schema";
import { toPortable } from "@/lib/portable";
import { newId } from "@/lib/ids";
import { fail, requireActor, resolveActor } from "@/lib/auth";
import { canEdit, orgsForUser } from "@/lib/tenant";
import type { GraphDoc } from "@/lib/types";

export const runtime = "nodejs";

/**
 * A signed-in visitor who opens someone else's link gets it in their
 * "Shared with me" list. Their own projects don't count.
 */
async function rememberShare(
  req: NextRequest,
  token: string,
  graph: { id: string; title: string; orgId: string; ownerId: string | null },
) {
  const actor = await resolveActor(req).catch(() => null);
  if (!actor) return;
  // Work from any workspace you belong to is yours, not "shared with" you.
  const mine = await orgsForUser(actor.user.id);
  if (mine.some((m) => m.org.id === graph.orgId)) return;
  const [owner] = graph.ownerId
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, graph.ownerId)).limit(1)
    : [];
  await db
    .insert(savedShares)
    .values({
      id: newId(),
      userId: actor.user.id,
      graphId: graph.id,
      token,
      title: graph.title || "Untitled",
      ownerName: owner?.name ?? "",
    })
    .onConflictDoUpdate({
      target: [savedShares.userId, savedShares.graphId],
      set: { token, title: graph.title || "Untitled", ownerName: owner?.name ?? "", lastOpenedAt: new Date() },
    });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [share] = await db.select().from(shares).where(eq(shares.token, token)).limit(1);
  if (!share) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: "share expired" }, { status: 410 });
  }
  const [graph] = await db.select().from(graphs).where(eq(graphs.id, share.graphId)).limit(1);
  if (!graph) return NextResponse.json({ error: "not found" }, { status: 404 });
  await rememberShare(req, share.token, graph).catch(() => {});
  return NextResponse.json({
    graphId: graph.id,
    title: graph.title,
    permission: share.permission,
    graph: graph.graph,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const [share] = await db.select().from(shares).where(eq(shares.token, token)).limit(1);
  if (!share || (share.permission !== "fork" && share.permission !== "edit")) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  let actor;
  try {
    actor = await requireActor(req);
  } catch (e) {
    return fail(e);
  }
  if (!canEdit(actor.membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [graph] = await db.select().from(graphs).where(eq(graphs.id, share.graphId)).limit(1);
  if (!graph) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    await assertCanCreateProject(actor.org.id, actor.org.plan);
  } catch (e) {
    return fail(e);
  }
  const portable = toPortable(graph.graph as GraphDoc, { title: graph.title });
  const id = newId();
  const [row] = await db
    .insert(graphs)
    .values({
      id,
      orgId: actor.org.id,
      ownerId: actor.user.id,
      title: `${graph.title || "Untitled"} copy`,
      graph: { nodes: portable.nodes, edges: portable.edges },
    })
    .returning();
  return NextResponse.json({ graph: row }, { status: 201 });
}
