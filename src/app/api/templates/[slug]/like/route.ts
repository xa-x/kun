import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { templateLikes, templates } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";

export const runtime = "nodejs";

/** Like a post, or take the like back. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { slug } = await params;
    const [row] = await db.select().from(templates).where(eq(templates.slug, slug)).limit(1);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    const removed = await db
      .delete(templateLikes)
      .where(and(eq(templateLikes.templateId, row.id), eq(templateLikes.userId, actor.user.id)))
      .returning({ id: templateLikes.templateId });
    const liked = removed.length === 0;
    if (liked) {
      await db
        .insert(templateLikes)
        .values({ templateId: row.id, userId: actor.user.id })
        .onConflictDoNothing();
    }
    const [updated] = await db
      .update(templates)
      .set({ likeCount: sql`greatest(0, ${templates.likeCount} + ${liked ? 1 : -1})` })
      .where(eq(templates.id, row.id))
      .returning({ likeCount: templates.likeCount });
    return NextResponse.json({ liked, likeCount: updated.likeCount });
  } catch (e) {
    return fail(e);
  }
}
