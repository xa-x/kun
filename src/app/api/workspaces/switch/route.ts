import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor, WORKSPACE_COOKIE } from "@/lib/auth";
import { orgsForUser } from "@/lib/tenant";
import { workspaceCookie } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const body = await req.json().catch(() => ({}));
    const all = await orgsForUser(actor.user.id);
    const target = all.find((r) => r.org.id === body.id);
    if (!target) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    const res = NextResponse.json({ id: target.org.id, name: target.org.name });
    res.cookies.set(WORKSPACE_COOKIE, target.org.id, workspaceCookie);
    return res;
  } catch (e) {
    return fail(e);
  }
}
