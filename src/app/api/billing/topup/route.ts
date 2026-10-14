import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditTopups, organizations } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";
import { canAdmin } from "@/lib/tenant";
import { isPlatformAdmin } from "@/lib/admin";
import { newId } from "@/lib/ids";
import { planOf, TOPUP_AMOUNTS_USD } from "@/lib/billing";
import { createTopupCheckout, creditsProductId, polarEnabled } from "@/lib/polar";

export const runtime = "nodejs";

/**
 * Credit top-up. With Polar configured it answers `{ url }` for a hosted
 * checkout, and the webhook credits the balance once the order is paid.
 *
 * Without a payment provider it credits the balance instantly. Like plan
 * checkout, that is only safe for the operator, so in production it is
 * limited to platform admins (ADMIN_EMAILS).
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canAdmin(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const amountUsd = Number(body.amountUsd);
    if (!(TOPUP_AMOUNTS_USD as readonly number[]).includes(amountUsd)) {
      return NextResponse.json({ error: "Unknown top-up amount" }, { status: 400 });
    }
    if (!planOf(actor.org.plan).topups) {
      return NextResponse.json(
        { error: "Credit top-ups are available on Pro and Team." },
        { status: 402 },
      );
    }
    if (polarEnabled()) {
      const productId = creditsProductId();
      if (!productId) {
        return NextResponse.json(
          { error: "Credit top-ups aren't on sale yet." },
          { status: 501 },
        );
      }
      return NextResponse.json({
        url: await createTopupCheckout({
          origin: req.nextUrl.origin,
          orgId: actor.org.id,
          userId: actor.user.id,
          email: actor.user.email,
          productId,
          amountUsd,
        }),
      });
    }
    if (process.env.NODE_ENV === "production" && !isPlatformAdmin(actor.user.email)) {
      return NextResponse.json(
        { error: "Credit top-ups aren't open yet — we'll email you when they are." },
        { status: 501 },
      );
    }
    const micro = amountUsd * 1e6;
    const balanceUsd = await db.transaction(async (tx) => {
      await tx.insert(creditTopups).values({
        id: newId(),
        orgId: actor.org.id,
        userId: actor.user.id,
        amountUsd: micro,
        source: "instant",
      });
      const [org] = await tx
        .update(organizations)
        .set({ creditBalance: sql`${organizations.creditBalance} + ${micro}` })
        .where(eq(organizations.id, actor.org.id))
        .returning({ balance: organizations.creditBalance });
      return org?.balance ?? 0;
    });
    return NextResponse.json({ balanceUsd });
  } catch (e) {
    return fail(e);
  }
}
