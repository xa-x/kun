import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations, users, workspaceInvites } from "@/db/schema";
import { fail, requireActor, WORKSPACE_COOKIE } from "@/lib/auth";
import { planOf } from "@/lib/billing";
import { workspaceUsage } from "@/lib/limits";
import { newId } from "@/lib/ids";
import { workspaceCookie } from "@/lib/workspaces";

export const runtime = "nodejs";

async function find(token: string) {
  const [row] = await db
    .select({ invite: workspaceInvites, org: organizations, inviter: users.name })
    .from(workspaceInvites)
    .innerJoin(organizations, eq(organizations.id, workspaceInvites.orgId))
    .leftJoin(users, eq(users.id, workspaceInvites.createdBy))
    .where(eq(workspaceInvites.token, token))
    .limit(1);
  if (!row || row.invite.expiresAt < new Date()) return null;
  return row;
}

/** What an invite is for. Public, so the join page can say so before sign-in. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const row = await find(token);
    if (!row) return NextResponse.json({ error: "This invite has expired or was cancelled." }, { status: 404 });
    return NextResponse.json({
      workspace: row.org.name,
      role: row.invite.role,
      invitedBy: row.inviter ?? "A teammate",
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const actor = await requireActor(req);
    const { token } = await params;
    const row = await find(token);
    if (!row) return NextResponse.json({ error: "This invite has expired or was cancelled." }, { status: 404 });
    if (row.invite.email && row.invite.email !== actor.user.email.toLowerCase()) {
      return NextResponse.json({ error: "This invite was sent to a different email address." }, { status: 403 });
    }
    const orgId = row.org.id;
    const [already] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, actor.user.id)))
      .limit(1);
    if (!already) {
      const use = await workspaceUsage(orgId);
      if (use.members >= planOf(row.org.plan).members) {
        return NextResponse.json({ error: "That workspace has no free seats left." }, { status: 402 });
      }
      await db
        .insert(memberships)
        .values({ id: newId(), orgId, userId: actor.user.id, role: row.invite.role })
        .onConflictDoNothing();
      await db.delete(workspaceInvites).where(eq(workspaceInvites.id, row.invite.id));
    }
    const res = NextResponse.json({ workspace: row.org.name });
    res.cookies.set(WORKSPACE_COOKIE, orgId, workspaceCookie);
    return res;
  } catch (e) {
    return fail(e);
  }
}
