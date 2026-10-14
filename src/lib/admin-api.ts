import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { adminAudit } from "@/db/schema";
import { requireActor, type Actor } from "./auth";
import { isPlatformAdmin } from "./admin";
import { newId } from "./ids";

/** The signed-in platform admin, or a 403 response to return. */
export async function requireAdmin(
  req: NextRequest,
): Promise<{ actor: Actor } | { denied: NextResponse }> {
  const actor = await requireActor(req);
  if (!isPlatformAdmin(actor.user.email)) {
    return { denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}

/** Write one line to the admin audit log. */
export async function audit(
  actor: Actor,
  action: string,
  target: { type: string; id: string },
  detail?: Record<string, unknown>,
) {
  await db.insert(adminAudit).values({
    id: newId(),
    actorEmail: actor.user.email,
    action,
    targetType: target.type,
    targetId: target.id,
    detail: detail ?? null,
  });
}

export const PLAN_IDS = ["free", "pro", "team"] as const;
/** Largest credit grant in one go, in USD. */
export const MAX_GRANT_USD = 500;
