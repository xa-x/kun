import { createHmac, timingSafeEqual } from "crypto";
import type { PlanId } from "./billing";

/**
 * Polar (polar.sh) is the payment provider: a merchant of record that sells
 * the plans as subscriptions and credit top-ups as one-time orders. Without
 * POLAR_ACCESS_TOKEN the billing routes fall back to instant switching.
 */
export function polarEnabled() {
  return !!process.env.POLAR_ACCESS_TOKEN;
}

function apiBase() {
  return process.env.POLAR_SERVER === "sandbox"
    ? "https://sandbox-api.polar.sh"
    : "https://api.polar.sh";
}

const PLAN_PRODUCT_ENV = {
  pro: "POLAR_PRODUCT_PRO",
  team: "POLAR_PRODUCT_TEAM",
} as const;

export function planProductId(plan: PlanId): string | undefined {
  return plan === "free" ? undefined : process.env[PLAN_PRODUCT_ENV[plan]] || undefined;
}

export function planOfProduct(productId: unknown): PlanId | null {
  if (typeof productId !== "string" || !productId) return null;
  if (productId === process.env.POLAR_PRODUCT_PRO) return "pro";
  if (productId === process.env.POLAR_PRODUCT_TEAM) return "team";
  return null;
}

export function creditsProductId(): string | undefined {
  return process.env.POLAR_PRODUCT_CREDITS || undefined;
}

async function polarPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error(`[polar] ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
    throw Object.assign(new Error("The payment provider refused the request."), {
      status: 502,
    });
  }
  return (await res.json()) as T;
}

/**
 * A subscription's current state. Webhooks can arrive late or out of order,
 * so the plan is synced from this rather than from the event payload.
 */
export async function fetchSubscription<T>(id: string): Promise<T | null> {
  const res = await fetch(`${apiBase()}/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`[polar] subscription lookup failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Where Polar sends the customer back to. */
export function billingReturnUrl(origin: string) {
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/billing`;
}

interface CheckoutBase {
  origin: string;
  orgId: string;
  userId: string;
  email: string;
}

/** Hosted checkout for a plan subscription. `seats` applies to seat-priced plans. */
export async function createPlanCheckout(
  opts: CheckoutBase & { plan: PlanId; productId: string; seats?: number },
) {
  const back = billingReturnUrl(opts.origin);
  const { url } = await polarPost<{ url: string }>("/v1/checkouts/", {
    products: [opts.productId],
    // Kun's Polar org defaults to SAR, and catalog prices exist in both.
    // Always present USD, which is what the plans and credit ledger use.
    currency: "usd",
    // One Polar customer per org, so any admin reaches the same portal
    // and the buyer leaving doesn't orphan the subscription.
    external_customer_id: opts.orgId,
    customer_email: opts.email,
    metadata: { kind: "plan", org_id: opts.orgId, plan: opts.plan },
    success_url: `${back}?checkout=success`,
    return_url: back,
    ...(opts.seats ? { seats: opts.seats } : {}),
  });
  return url;
}

/**
 * Hosted checkout for a one-time credit top-up. The amount is an ad-hoc
 * fixed price on the credits product, so one product covers every size.
 */
export async function createTopupCheckout(
  opts: CheckoutBase & { productId: string; amountUsd: number },
) {
  const back = billingReturnUrl(opts.origin);
  const { url } = await polarPost<{ url: string }>("/v1/checkouts/", {
    products: [opts.productId],
    currency: "usd",
    prices: {
      [opts.productId]: [
        { amount_type: "fixed", price_amount: opts.amountUsd * 100, price_currency: "usd" },
      ],
    },
    // One Polar customer per org, so any admin reaches the same portal
    // and the buyer leaving doesn't orphan the subscription.
    external_customer_id: opts.orgId,
    customer_email: opts.email,
    metadata: { kind: "topup", org_id: opts.orgId, user_id: opts.userId },
    // The balance is credited with what was paid; a code would only shrink it.
    allow_discount_codes: false,
    success_url: `${back}?checkout=success`,
    return_url: back,
  });
  return url;
}

/** Polar's customer portal, where a subscriber changes or cancels their plan. */
export async function createPortalUrl(customerId: string, origin: string) {
  const { customer_portal_url } = await polarPost<{ customer_portal_url: string }>(
    "/v1/customer-sessions/",
    { customer_id: customerId, return_url: billingReturnUrl(origin) },
  );
  return customer_portal_url;
}

const TOLERANCE_S = 5 * 60;

/**
 * Verify a Standard Webhooks signature: HMAC-SHA256 over `id.timestamp.body`,
 * base64, listed as space-separated `v1,<sig>` entries. The key is the
 * base64-decoded secret after `whsec_`; Polar's older scheme keyed on the raw
 * secret string instead, so both are accepted.
 */
export function verifyWebhook(
  raw: string,
  headers: { get(name: string): string | null },
  secret: string,
  nowMs = Date.now(),
): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > TOLERANCE_S) return false;

  const signed = `${id}.${timestamp}.${raw}`;
  const keys = [Buffer.from(secret.replace(/^whsec_/, ""), "base64"), Buffer.from(secret)];
  const expected = keys.map((k) => createHmac("sha256", k).update(signed).digest());
  return signatures.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return expected.some((e) => e.length === given.length && timingSafeEqual(e, given));
  });
}
