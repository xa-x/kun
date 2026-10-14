import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/auth";
import { audit, requireAdmin } from "@/lib/admin-api";
import { patchPlatform, platform, savePlatform } from "@/lib/platform";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    return NextResponse.json({ settings: await platform() });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const cur = await platform();
    const next = patchPlatform(cur, await req.json().catch(() => ({})));
    await savePlatform(next);
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(cur[k]));
    if (changed.length) await audit(gate.actor, "settings.update", { type: "settings", id: changed.join(",") }, { changed: Object.fromEntries(changed.map((k) => [k, next[k]])) });
    return NextResponse.json({ settings: next });
  } catch (e) {
    return fail(e);
  }
}
