import { NextRequest, NextResponse } from "next/server";
import { ensureActor, publicActor } from "@/lib/auth";
import { envProviderFlags } from "@/lib/providers";
import { planOf } from "@/lib/billing";
import { ensureJobLoop } from "@/lib/runs/worker";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensureJobLoop();
  try {
    const actor = await ensureActor(req);
    return NextResponse.json({
      ...publicActor(actor),
      plan: planOf(actor.org.plan),
      envProviders: envProviderFlags(),
    });
  } catch {
    // Signed out: answer 200 with user:null so clients can redirect to
    // /login instead of treating this as a server error.
    return NextResponse.json({
      user: null,
      plan: planOf(null),
      envProviders: envProviderFlags(),
    });
  }
}
