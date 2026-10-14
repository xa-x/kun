import { NextResponse } from "next/server";
import { fail } from "@/lib/auth";
import { loadActivity } from "@/lib/community-feed";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ events: await loadActivity() });
  } catch (e) {
    return fail(e);
  }
}
