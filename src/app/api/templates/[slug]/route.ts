import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { templateLikes, templates, users } from "@/db/schema";
import { fail, requireActor, resolveActor } from "@/lib/auth";
import { canEdit } from "@/lib/tenant";
import { publicTemplate } from "@/lib/templates";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const [found] = await db
      .select({ t: templates, creator: users.name })
      .from(templates)
      .leftJoin(users, eq(users.id, templates.publishedBy))
      .where(eq(templates.slug, slug))
      .limit(1);
    if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });
    const row = found.t;
    const viewer = await resolveActor(req).catch(() => null);
    const [like] = viewer
      ? await db
          .select({ id: templateLikes.templateId })
          .from(templateLikes)
          .where(and(eq(templateLikes.templateId, row.id), eq(templateLikes.userId, viewer.user.id)))
          .limit(1)
      : [];
    return NextResponse.json({
      template: {
        ...publicTemplate(row),
        workbook: row.workbook,
        media: Array.isArray(row.media) ? row.media : [],
        likeCount: row.likeCount,
        liked: Boolean(like),
        creator: { name: found.creator || "Kun creator" },
      },
    });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const actor = await requireActor(req);
    const { slug } = await params;
    const [row] = await db.select().from(templates).where(eq(templates.slug, slug)).limit(1);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (row.orgId !== actor.org.id || !canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await db.delete(templates).where(eq(templates.id, row.id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
