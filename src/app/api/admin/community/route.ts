import { NextRequest, NextResponse } from "next/server";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { templates, users } from "@/db/schema";
import { fail } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80).replace(/[%_\\]/g, "\\$&");
    const rows = await db
      .select({ t: templates, creator: users.name, email: users.email })
      .from(templates)
      .leftJoin(users, eq(users.id, templates.publishedBy))
      .where(q ? or(ilike(templates.title, `%${q}%`), ilike(users.email, `%${q}%`)) : undefined)
      .orderBy(desc(templates.createdAt))
      .limit(100);
    return NextResponse.json({
      posts: rows.map(({ t, creator, email }) => ({
        slug: t.slug,
        title: t.title,
        creator: creator ?? "—",
        email: email ?? "",
        likes: t.likeCount,
        remixes: t.cloneCount,
        media: Array.isArray(t.media) ? t.media.length : 0,
        featured: Boolean(t.featured),
        createdAt: t.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
