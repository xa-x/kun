import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canAdmin } from "@/lib/tenant";
import { planOf, PLANS } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Dev-mode checkout: switches the org's plan instantly. When STRIPE_SECRET_KEY
 * is configured this will be replaced by a real Stripe Checkout session.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const planId = String(body.plan ?? "");
    if (!(planId in PLANS)) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    if (process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe checkout is not wired yet — remove STRIPE_SECRET_KEY to use instant switching." },
        { status: 501 },
      );
    }
    await db
      .update(organizations)
      .set({ plan: planId })
      .where(eq(organizations.id, actor.org.id));
    return NextResponse.json({ plan: planOf(planId) });
  } catch (e) {
    return fail(e);
  }
}
