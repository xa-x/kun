import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  await destroySession();
  const res = NextResponse.json({ ok: true });
  // Clear the legacy pre-Supabase cookie, if any.
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
