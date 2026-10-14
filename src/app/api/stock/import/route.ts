import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { canEdit } from "@/lib/tenant";
import { saveArtifact } from "@/lib/artifacts";
import { stockMeta } from "@/lib/assets";
import { getPhoto, trackDownload, unsplashConfigured } from "@/lib/unsplash";

export const runtime = "nodejs";

/** Save one Unsplash photo into the workspace's assets, with its credit. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireActor(req);
    if (!canEdit(actor.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!unsplashConfigured()) {
      return NextResponse.json({ error: "Stock photos aren’t set up on this server." }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.slice(0, 40) : "";
    if (!/^[\w-]+$/.test(id)) {
      return NextResponse.json({ error: "photo id required" }, { status: 400 });
    }
    const photo = await getPhoto(id);
    // Only Unsplash's own image host; the id came from the client.
    const src = new URL(photo.urls.regular);
    if (src.hostname !== "images.unsplash.com") {
      return NextResponse.json({ error: "Unexpected photo source." }, { status: 502 });
    }
    const img = await fetch(src);
    if (!img.ok) return NextResponse.json({ error: "Couldn’t download the photo." }, { status: 502 });
    const buf = new Uint8Array(await img.arrayBuffer());
    const art = await saveArtifact(buf, img.headers.get("content-type") || "image/jpeg", "image", undefined, actor.org.id, {
      source: "stock",
      meta: stockMeta(photo) as unknown as Record<string, unknown>,
    });
    await trackDownload(photo.links.download_location);
    return NextResponse.json({ id: art.id, url: `/api/media/${art.id}`, kind: "image" }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
