import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations } from "@/db/schema";
import { fail, requireActor, WORKSPACE_COOKIE } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { canAdmin, orgsForUser } from "@/lib/tenant";
import { cleanWorkspaceName, workspaceCookie } from "@/lib/workspaces";
import { workspaceCap } from "@/lib/billing";
import { deleteWorkspace } from "@/lib/workspace-delete";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const all = await orgsForUser(actor.user.id);
    return NextResponse.json({
      workspaces: all.map(({ org, membership }) => ({
        id: org.id,
        name: org.name,
        plan: org.plan,
        role: membership.role,
        active: org.id === actor.org.id,
      })),
      canCreate:
        all.filter((r) => r.membership.role === "owner").length <
        workspaceCap(all.filter((r) => r.membership.role === "owner").map((r) => r.org.plan)),
    });
  } catch (e) {
    return fail(e);
  }
}

/** Create a workspace and switch to it. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const body = await req.json().catch(() => ({}));
    const name = cleanWorkspaceName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Give the workspace a name (2 letters or more)." }, { status: 400 });
    }
    const owned = (await orgsForUser(actor.user.id)).filter(
      (r) => r.membership.role === "owner",
    );
    const cap = workspaceCap(owned.map((r) => r.org.plan));
    if (owned.length >= cap) {
      return NextResponse.json(
        { error: `You own ${owned.length} workspaces, the most your plan allows (${cap}).${cap < 10 ? " A paid plan raises it." : ""}` },
        { status: 402 },
      );
    }
    const id = newId();
    await db.insert(organizations).values({
      id,
      name,
      slug: `org-${id}`,
      plan: "free",
      createdBy: actor.user.id,
    });
    await db.insert(memberships).values({ id: newId(), orgId: id, userId: actor.user.id, role: "owner" });
    const res = NextResponse.json({ id, name }, { status: 201 });
    res.cookies.set(WORKSPACE_COOKIE, id, workspaceCookie);
    return res;
  } catch (e) {
    return fail(e);
  }
}

/** Rename the current workspace. */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) {
      return NextResponse.json({ error: "Only admins can rename a workspace." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const name = cleanWorkspaceName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Give the workspace a name (2 letters or more)." }, { status: 400 });
    }
    await db.update(organizations).set({ name }).where(eq(organizations.id, actor.org.id));
    return NextResponse.json({ id: actor.org.id, name });
  } catch (e) {
    return fail(e);
  }
}

/** Delete the current workspace for good. Owner only; type its name to confirm. */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (actor.membership.role !== "owner") {
      return NextResponse.json({ error: "Only the owner can delete a workspace." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== actor.org.name) {
      return NextResponse.json({ error: "Type the workspace name to confirm." }, { status: 400 });
    }
    const mine = await orgsForUser(actor.user.id);
    const next = mine.find((r) => r.org.id !== actor.org.id);
    if (!next) {
      return NextResponse.json(
        { error: "This is your only workspace. Create another one first." },
        { status: 409 },
      );
    }
    if (actor.org.polarSubscriptionId) {
      return NextResponse.json(
        { error: "Cancel this workspace’s subscription under Plan and usage first." },
        { status: 409 },
      );
    }
    await deleteWorkspace(actor.org.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(WORKSPACE_COOKIE, next.org.id, workspaceCookie);
    return res;
  } catch (e) {
    return fail(e);
  }
}
