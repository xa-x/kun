import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { adminAudit } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const rows = await db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(200);
    return NextResponse.json({ entries: rows });
  } catch (e) {
    return fail(e);
  }
}
