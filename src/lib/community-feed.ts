import { desc, eq, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { communityEvents, templateLikes, templates, users } from "@/db/schema";
import { trendingScore, type ShowcaseItem } from "./community";

export type FeedSort = "trending" | "new" | "remixed";

export interface Post {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  cloneCount: number;
  likeCount: number;
  liked: boolean;
  featured: boolean;
  createdAt: string;
  cover: ShowcaseItem | null;
  media: ShowcaseItem[];
  creator: { name: string };
  mine: boolean;
}

const asMedia = (raw: unknown): ShowcaseItem[] =>
  Array.isArray(raw)
    ? raw.filter(
        (m): m is ShowcaseItem =>
          !!m && typeof m === "object" && typeof (m as ShowcaseItem).id === "string",
      )
    : [];

/** Community posts, filtered and ranked. `viewerId` marks what they liked or made. */
export async function loadPosts(opts: {
  sort: FeedSort;
  q?: string;
  tag?: string;
  viewerId?: string | null;
  limit?: number;
}): Promise<Post[]> {
  const rows = await db
    .select({ t: templates, creator: users.name })
    .from(templates)
    .leftJoin(users, eq(users.id, templates.publishedBy))
    .orderBy(desc(templates.createdAt))
    .limit(300);

  const q = (opts.q ?? "").trim().toLowerCase();
  const tag = (opts.tag ?? "").trim().toLowerCase();
  const kept = rows.filter(({ t }) => {
    const tags = Array.isArray(t.tags) ? (t.tags as string[]) : [];
    if (tag && !tags.includes(tag)) return false;
    if (!q) return true;
    return `${t.title} ${t.description} ${tags.join(" ")}`.toLowerCase().includes(q);
  });

  const likedIds = new Set<string>();
  if (opts.viewerId && kept.length) {
    const liked = await db
      .select({ id: templateLikes.templateId })
      .from(templateLikes)
      .where(
        and(
          eq(templateLikes.userId, opts.viewerId),
          inArray(templateLikes.templateId, kept.map((r) => r.t.id)),
        ),
      );
    for (const l of liked) likedIds.add(l.id);
  }

  const posts: Post[] = kept.map(({ t, creator }) => {
    const media = asMedia(t.media);
    const cover = media.find((m) => m.id === t.coverId) ?? null;
    return {
      id: t.id,
      slug: t.slug,
      title: t.title,
      description: t.description,
      tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
      cloneCount: t.cloneCount,
      likeCount: t.likeCount,
      liked: likedIds.has(t.id),
      featured: Boolean(t.featured),
      createdAt: t.createdAt.toISOString(),
      cover,
      media,
      creator: { name: creator || "Kun creator" },
      mine: !!opts.viewerId && t.publishedBy === opts.viewerId,
    };
  });

  const now = Date.now();
  if (opts.sort === "trending") {
    posts.sort((a, b) => Number(b.featured) - Number(a.featured) || trendingScore(b, now) - trendingScore(a, now));
  } else if (opts.sort === "remixed") {
    posts.sort((a, b) => b.cloneCount - a.cloneCount || b.likeCount - a.likeCount);
  }
  return posts.slice(0, opts.limit ?? 60);
}

export interface FeedEvent {
  id: string;
  kind: "published" | "remixed";
  who: string;
  title: string;
  slug: string;
  at: string;
}

/** What just happened: publishes and remixes, newest first. */
export async function loadActivity(limit = 14): Promise<FeedEvent[]> {
  const rows = await db
    .select({
      id: communityEvents.id,
      kind: communityEvents.kind,
      at: communityEvents.createdAt,
      who: users.name,
      title: templates.title,
      slug: templates.slug,
    })
    .from(communityEvents)
    .innerJoin(templates, eq(templates.id, communityEvents.templateId))
    .leftJoin(users, eq(users.id, communityEvents.userId))
    .orderBy(desc(communityEvents.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "remixed" ? "remixed" : "published",
    who: r.who || "Someone",
    title: r.title,
    slug: r.slug,
    at: r.at.toISOString(),
  }));
}
