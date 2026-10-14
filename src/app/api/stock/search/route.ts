import { NextRequest, NextResponse } from "next/server";
import { fail, requireActor } from "@/lib/auth";
import { stockSearchItem } from "@/lib/assets";
import { listPhotos, searchPhotos, unsplashConfigured } from "@/lib/unsplash";

export const runtime = "nodejs";

/** Free stock photos from Unsplash. Without an access key the tab says how to enable it. */
export async function GET(req: NextRequest) {
  try {
    await requireActor(req);
    if (!unsplashConfigured()) {
      return NextResponse.json({ configured: false, photos: [], totalPages: 0 });
    }
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const page = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1));
    if (!q) {
      const list = await listPhotos(page);
      return NextResponse.json({ configured: true, photos: list.map(stockSearchItem), totalPages: 50 });
    }
    const res = await searchPhotos(q, page);
    return NextResponse.json({
      configured: true,
      photos: res.results.map(stockSearchItem),
      totalPages: res.total_pages,
    });
  } catch (e) {
    return fail(e);
  }
}
