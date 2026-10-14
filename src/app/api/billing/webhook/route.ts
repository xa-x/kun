import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditTopups, organizations } from "@/db/schema";
import { newId } from "@/lib/ids";
import {
  creditsProductId,
  fetchSubscription,
  planOfProduct,
  polarEnabled,
  verifyWebhook,
} from "@/lib/polar";

export const runtime = "nodejs";

type Meta = Record<string, unknown>;

interface PolarOrder {
  id: string;
  paid?: boolean;
  net_amount?: number;
  refunded_amount?: number;
  currency?: string;
  product_id?: string | null;
  metadata?: Meta;
}

interface PolarSubscription {
  id: string;
  status: string;
  product_id?: string;
  customer_id?: string;
  ended_at?: string | null;
  metadata?: Meta;
}

function orgIdOf(meta?: Meta) {
  return typeof meta?.org_id === "string" && meta.org_id ? meta.org_id : null;
}

/**
 * Credit a paid top-up order to the org's balance. Keyed on the order id, so
 * a redelivered webhook credits nothing the second time.
 */
async function creditTopup(order: PolarOrder) {
  const orgId = orgIdOf(order.metadata);
  if (!orgId || order.metadata?.kind !== "topup") return;
  if (!order.paid || order.product_id !== creditsProductId()) return;
  if (order.currency !== "usd" || !order.net_amount || order.net_amount <= 0) return;
  // Polar amounts are cents; the balance is micro-dollars.
  const micro = order.net_amount * 1e4;
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(creditTopups)
      .values({
        id: newId(),
        orgId,
        userId: typeof order.metadata?.user_id === "string" ? order.metadata.user_id : null,
        amountUsd: micro,
        source: "polar",
        ref: order.id,
      })
      .onConflictDoNothing({ target: creditTopups.ref })
      .returning({ id: creditTopups.id });
    if (!inserted.length) return;
    await tx
      .update(organizations)
      .set({ creditBalance: sql`${organizations.creditBalance} + ${micro}` })
      .where(eq(organizations.id, orgId));
  });
}

/**
 * Take back credit for a refunded top-up. One refund row per order holds the
 * cumulative refunded amount, so partial refunds and redeliveries apply only
 * the difference. The balance floors at zero; spent credit can't be undone.
 */
async function refundTopup(order: PolarOrder) {
  const orgId = orgIdOf(order.metadata);
  if (!orgId || order.metadata?.kind !== "topup") return;
  const refunded = order.refunded_amount ?? order.net_amount ?? 0;
  if (refunded <= 0) return;
  const micro = Math.min(refunded, order.net_amount ?? refunded) * 1e4;
  const ref = `refund:${order.id}`;
  await db.transaction(async (tx) => {
    const [prev] = await tx
      .select({ id: creditTopups.id, amountUsd: creditTopups.amountUsd })
      .from(creditTopups)
      .where(eq(creditTopups.ref, ref))
      .for("update");
    const delta = micro - (prev ? -prev.amountUsd : 0);
    if (delta <= 0) return;
    if (prev) {
      await tx.update(creditTopups).set({ amountUsd: -micro }).where(eq(creditTopups.id, prev.id));
    } else {
      await tx
        .insert(creditTopups)
        .values({ id: newId(), orgId, userId: null, amountUsd: -micro, source: "polar", ref });
    }
    await tx
      .update(organizations)
      .set({ creditBalance: sql`greatest(0, ${organizations.creditBalance} - ${delta})` })
      .where(eq(organizations.id, orgId));
  });
}

/**
 * Mirror a subscription onto the org's plan. A subscription set to cancel at
 * period end stays `active` until Polar revokes it, so access lasts the
 * period; `past_due` is left alone while the customer can still recover it.
 */
async function syncSubscription(event: PolarSubscription) {
  // Events can be delivered late or out of order; the live state is the truth.
  let sub = event;
  if (polarEnabled()) {
    const live = await fetchSubscription<PolarSubscription>(event.id);
    if (!live) return;
    sub = { ...live, metadata: live.metadata ?? event.metadata };
  }
  const orgId = orgIdOf(sub.metadata);
  if (!orgId) return;
  const ended =
    ["canceled", "unpaid", "incomplete_expired"].includes(sub.status);
  if (ended) {
    // Only the subscription that granted the plan may take it away.
    await db
      .update(organizations)
      .set({ plan: "free", polarSubscriptionId: null })
      .where(
        and(eq(organizations.id, orgId), eq(organizations.polarSubscriptionId, sub.id)),
      );
    return;
  }
  const plan = planOfProduct(sub.product_id);
  if (!plan || sub.ended_at || !["active", "trialing"].includes(sub.status)) return;
  // A second live subscription (double checkout) must not displace the one
  // already tracked, or cancelling the first would never downgrade the org.
  const [current] = await db
    .select({ sub: organizations.polarSubscriptionId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (current?.sub && current.sub !== sub.id) {
    console.error(`[polar] org ${orgId} already has subscription ${current.sub}; ignoring ${sub.id}`);
    return;
  }
  await db
    .update(organizations)
    .set({
      plan,
      polarSubscriptionId: sub.id,
      polarCustomerId: sub.customer_id ?? null,
    })
    .where(eq(organizations.id, orgId));
}

/** Polar webhook: authenticated by its signature, not by a session. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers, process.env.POLAR_WEBHOOK_SECRET ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }
  try {
    const event = JSON.parse(raw) as { type?: string; data?: unknown };
    switch (event.type) {
      case "order.paid":
        await creditTopup(event.data as PolarOrder);
        break;
      case "order.refunded":
        await refundTopup(event.data as PolarOrder);
        break;
      case "subscription.active":
      case "subscription.updated":
      case "subscription.revoked":
        await syncSubscription(event.data as PolarSubscription);
        break;
    }
    return NextResponse.json({ received: true }, { status: 202 });
  } catch (e) {
    // A 5xx makes Polar retry the delivery.
    console.error("[polar] webhook failed:", e);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
