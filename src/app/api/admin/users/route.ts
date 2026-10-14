import { NextRequest, NextResponse } from "next/server";
import { desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations, users } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";
import { isPlatformAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[%_\\]/g, "\\$&");
    const rows = await db
      .select()
      .from(users)
      .where(q ? or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(100);
    const ms = rows.length
      ? await db
          .select({ userId: memberships.userId, role: memberships.role, id: organizations.id, name: organizations.name, plan: organizations.plan })
          .from(memberships)
          .innerJoin(organizations, eq(organizations.id, memberships.orgId))
          .where(inArray(memberships.userId, rows.map((r) => r.id)))
      : [];
    return NextResponse.json({
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        admin: isPlatformAdmin(u.email),
        workspaces: ms.filter((m) => m.userId === u.id).map((m) => ({ id: m.id, name: m.name, plan: m.plan, role: m.role })),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
