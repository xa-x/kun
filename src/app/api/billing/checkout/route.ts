import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canAdmin } from "@/lib/tenant";
import { isPlatformAdmin } from "@/lib/admin";
import { planOf, PLANS } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Checkout without a payment provider: switches the org's plan instantly.
 * That is only safe for the operator, so in production it is limited to
 * platform admins (ADMIN_EMAILS) until real Stripe Checkout replaces it.
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
    if (process.env.NODE_ENV === "production" && !isPlatformAdmin(actor.user.email)) {
      return NextResponse.json(
        { error: "Paid plans aren't open yet — we'll email you when they are." },
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
