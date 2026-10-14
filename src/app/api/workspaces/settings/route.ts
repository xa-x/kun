import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canAdmin } from "@/lib/tenant";
import { mergeStored, patchSettings, workspaceSettings } from "@/lib/workspace-settings";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    return NextResponse.json({
      settings: workspaceSettings(actor.org.settings),
      canEdit: canAdmin(actor.membership.role),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) {
      return NextResponse.json({ error: "Only admins can change privacy settings." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const next = patchSettings(workspaceSettings(actor.org.settings), body);
    await db.update(organizations).set({ settings: mergeStored(actor.org.settings, next) }).where(eq(organizations.id, actor.org.id));
    return NextResponse.json({ settings: next });
  } catch (e) {
    return fail(e);
  }
}
