import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";

export const runtime = "nodejs";

/** Change the display name. */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (name.length < 1) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    await db.update(users).set({ name }).where(eq(users.id, actor.user.id));
    return NextResponse.json({ name });
  } catch (e) {
    return fail(e);
  }
}
