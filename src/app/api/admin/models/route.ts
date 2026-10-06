import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";
import {
  policyMap,
  setModelPolicy,
  invalidatePolicyCache,
} from "@/lib/model-policy";

export const runtime = "nodejs";

/**
 * Admin model management — enable/disable, price override, margin.
 * GET lists current policy rows; PUT upserts one model's policy.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!isPlatformAdmin(actor.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const map = await policyMap();
    const rows = map.size
      ? [...map.values()].sort((a, b) => a.model.localeCompare(b.model))
      : [];
    return NextResponse.json({ policies: rows });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!isPlatformAdmin(actor.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (!model || model.includes(" ")) {
      return NextResponse.json(
        { error: "model id required (e.g. openai/gpt-5.2)" },
        { status: 400 },
      );
    }
    const patch: Parameters<typeof setModelPolicy>[0] = { model };
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (body.pricePerUsd === null) patch.pricePerUsd = null;
    else if (typeof body.pricePerUsd === "number" && body.pricePerUsd >= 0)
      patch.pricePerUsd = body.pricePerUsd;
    if (typeof body.marginPct === "number" && body.marginPct >= 0 && body.marginPct <= 1000)
      patch.marginPct = Math.round(body.marginPct);
    await setModelPolicy(patch);
    invalidatePolicyCache();
    const map = await policyMap();
    return NextResponse.json({ policy: map.get(model) ?? null });
  } catch (e) {
    return fail(e);
  }
}
