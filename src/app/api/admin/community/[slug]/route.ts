import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { communityEvents, templateLikes, templates } from "@/db/schema";
import { fail } from "@/lib/auth";
import { audit, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

async function find(slug: string) {
  const [row] = await db.select().from(templates).where(eq(templates.slug, slug)).limit(1);
  return row ?? null;
}

/** Feature a post (pins it to the top of Trending) or take the feature away. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { slug } = await params;
    const row = await find(slug);
    if (!row) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (typeof body.featured !== "boolean") {
      return NextResponse.json({ error: "featured must be true or false." }, { status: 400 });
    }
    await db.update(templates).set({ featured: body.featured }).where(eq(templates.id, row.id));
    await audit(gate.actor, body.featured ? "post.feature" : "post.unfeature", { type: "post", id: slug }, { title: row.title });
    return NextResponse.json({ featured: body.featured });
  } catch (e) {
    return fail(e);
  }
}

/** Take a post down. The author's project is not touched. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const gate = await requireAdmin(req);
    if ("denied" in gate) return gate.denied;
    const { slug } = await params;
    const row = await find(slug);
    if (!row) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    await db.delete(templateLikes).where(eq(templateLikes.templateId, row.id));
    await db.delete(communityEvents).where(eq(communityEvents.templateId, row.id));
    await db.delete(templates).where(eq(templates.id, row.id));
    await audit(gate.actor, "post.remove", { type: "post", id: slug }, { title: row.title, publishedBy: row.publishedBy });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
