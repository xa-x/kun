import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canManageMember, isAssignable } from "@/lib/members";
import { canAdmin } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const rows = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: memberships.role,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, actor.org.id))
      .orderBy(asc(memberships.createdAt));
    return NextResponse.json({
      members: rows.map((r) => ({ ...r, you: r.userId === actor.user.id })),
      canManage: canAdmin(actor.membership.role),
      role: actor.membership.role,
    });
  } catch (e) {
    return fail(e);
  }
}

async function target(orgId: string, userId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Change someone's role. */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const body = await req.json().catch(() => ({}));
    const row = typeof body.userId === "string" ? await target(actor.org.id, body.userId) : null;
    if (!row) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    if (!isAssignable(body.role)) {
      return NextResponse.json({ error: "Choose admin, editor or viewer." }, { status: 400 });
    }
    const self = row.userId === actor.user.id;
    if (self || !canAdmin(actor.membership.role) || !canManageMember(actor.membership.role, row.role, false)) {
      return NextResponse.json({ error: "You can’t change that role." }, { status: 403 });
    }
    await db.update(memberships).set({ role: body.role }).where(eq(memberships.id, row.id));
    return NextResponse.json({ userId: row.userId, role: body.role });
  } catch (e) {
    return fail(e);
  }
}

/** Remove a member, or leave (no `userId`, or your own). */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const userId = req.nextUrl.searchParams.get("userId") || actor.user.id;
    const row = await target(actor.org.id, userId);
    if (!row) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const self = userId === actor.user.id;
    if (row.role === "owner") {
      return NextResponse.json(
        { error: "The owner can’t be removed. Delete the workspace instead." },
        { status: 403 },
      );
    }
    if (!canManageMember(actor.membership.role, row.role, self) || (!self && !canAdmin(actor.membership.role))) {
      return NextResponse.json({ error: "You can’t remove that member." }, { status: 403 });
    }
    await db.delete(memberships).where(eq(memberships.id, row.id));
    return NextResponse.json({ ok: true, left: self });
  } catch (e) {
    return fail(e);
  }
}
