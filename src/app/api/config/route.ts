import { NextRequest, NextResponse } from "next/server";
import { envProviderFlags } from "@/lib/providers";
import { resolveActor } from "@/lib/auth";
import { planOf } from "@/lib/billing";

export const runtime = "nodejs";

/** Public-safe: provider flags don't need an account; plan/theme do. */
export async function GET(req: NextRequest) {
  const actor = await resolveActor(req).catch(() => null);
  return NextResponse.json({
    envProviders: envProviderFlags(),
    ...(actor
      ? { plan: planOf(actor.org.plan), theme: actor.user.theme }
      : { plan: planOf(null) }),
  });
}
