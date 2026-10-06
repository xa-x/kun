import { NextRequest, NextResponse } from "next/server";
import { fail, login, publicActor } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { actor } = await login(String(body.email ?? ""), String(body.password ?? ""));
    return NextResponse.json({
      ...publicActor(actor),
      needsConfirmation: false,
    });
  } catch (e) {
    return fail(e);
  }
}
