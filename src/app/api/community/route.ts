import { NextRequest, NextResponse } from "next/server";
import { fail, resolveActor } from "@/lib/auth";
import { loadPosts, type FeedSort } from "@/lib/community-feed";

export const runtime = "nodejs";

const SORTS: FeedSort[] = ["trending", "new", "remixed"];

/** Public. Signed-in viewers also learn which posts they liked. */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const sort = SORTS.find((s) => s === sp.get("sort")) ?? "trending";
    const viewer = await resolveActor(req).catch(() => null);
    const posts = await loadPosts({
      sort,
      q: (sp.get("q") ?? "").slice(0, 80),
      tag: (sp.get("tag") ?? "").slice(0, 24),
      viewerId: viewer?.user.id,
      limit: Math.min(60, Math.max(1, Number(sp.get("limit")) || 60)),
    });
    // Popular tags across everything, for the filter row.
    const counts = new Map<string, number>();
    for (const p of posts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const tags = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
    return NextResponse.json({ posts, tags });
  } catch (e) {
    return fail(e);
  }
}
