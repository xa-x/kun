import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { workspaceInvites } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { planOf } from "@/lib/billing";
import { workspaceUsage } from "@/lib/limits";
import { INVITE_DAYS, isAssignable } from "@/lib/members";
import { newId, newToken } from "@/lib/ids";
import { canAdmin } from "@/lib/tenant";

export const runtime = "nodejs";

const live = (orgId: string) =>
  and(eq(workspaceInvites.orgId, orgId), gt(workspaceInvites.expiresAt, new Date()));

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) return NextResponse.json({ invites: [] });
    const rows = await db
      .select()
      .from(workspaceInvites)
      .where(live(actor.org.id))
      .orderBy(desc(workspaceInvites.createdAt));
    return NextResponse.json({
      invites: rows.map((r) => ({
        id: r.id,
        role: r.role,
        email: r.email,
        url: `/join/${r.token}`,
        expiresAt: r.expiresAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) {
      return NextResponse.json({ error: "Only admins can invite people." }, { status: 403 });
    }
    const plan = planOf(actor.org.plan);
    if (plan.members <= 1) {
      return NextResponse.json(
        { error: `The ${plan.label} plan is for one person. Team workspaces hold up to ${planOf("team").members}.` },
        { status: 402 },
      );
    }
    const use = await workspaceUsage(actor.org.id);
    if (use.members + use.invites >= plan.members) {
      return NextResponse.json(
        { error: `This workspace has ${use.members} members and ${use.invites} open invites, which fills its ${plan.members} seats.` },
        { status: 402 },
      );
    }
    const body = await req.json().catch(() => ({}));
    const role = isAssignable(body.role) ? body.role : "editor";
    const email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase().slice(0, 200) : null;
    const token = newToken(24);
    const [row] = await db
      .insert(workspaceInvites)
      .values({
        id: newId(),
        orgId: actor.org.id,
        token,
        role,
        email,
        createdBy: actor.user.id,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      })
      .returning();
    return NextResponse.json(
      { id: row.id, role, email, url: `/join/${token}`, expiresAt: row.expiresAt },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) {
      return NextResponse.json({ error: "Only admins can cancel invites." }, { status: 403 });
    }
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db
      .delete(workspaceInvites)
      .where(and(eq(workspaceInvites.id, id), eq(workspaceInvites.orgId, actor.org.id)));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
