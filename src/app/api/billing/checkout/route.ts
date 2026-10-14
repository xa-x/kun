import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canAdmin } from "@/lib/tenant";
import { isPlatformAdmin } from "@/lib/admin";
import { planOf, PLANS, type PlanId } from "@/lib/billing";
import {
  createPlanCheckout,
  createPortalUrl,
  planProductId,
  polarEnabled,
} from "@/lib/polar";

export const runtime = "nodejs";

/**
 * Plan checkout. With Polar configured it answers `{ url }`: hosted checkout
 * for a new subscription, or Polar's customer portal when the org already
 * has one to change or cancel — the webhook then updates the plan.
 *
 * Without a payment provider it switches the org's plan instantly. That is
 * only safe for the operator, so in production it is limited to platform
 * admins (ADMIN_EMAILS).
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
    if (polarEnabled()) {
      const origin = req.nextUrl.origin;
      if (actor.org.polarSubscriptionId && actor.org.polarCustomerId) {
        return NextResponse.json({
          url: await createPortalUrl(actor.org.polarCustomerId, origin),
        });
      }
      const productId = planProductId(planId as PlanId);
      if (productId) {
        const [seats] = await db
          .select({ n: sql<number>`count(*)` })
          .from(memberships)
          .where(eq(memberships.orgId, actor.org.id));
        return NextResponse.json({
          url: await createPlanCheckout({
            origin,
            orgId: actor.org.id,
            userId: actor.user.id,
            email: actor.user.email,
            plan: planId as PlanId,
            productId,
            seats: planOf(planId).seatUsd ? Math.max(1, Number(seats?.n ?? 1)) : undefined,
          }),
        });
      }
      if (planId !== "free") {
        return NextResponse.json(
          { error: "This plan isn't on sale yet." },
          { status: 501 },
        );
      }
      // Free with no subscription to cancel: nothing to pay for, switch below.
    } else if (process.env.NODE_ENV === "production" && !isPlatformAdmin(actor.user.email)) {
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
