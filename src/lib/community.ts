import type { GraphDoc, NodeOutput } from "./types";

export interface ShowcaseItem {
  id: string;
  kind: "image" | "audio" | "video";
}

export const SHOWCASE_MAX = 6;

/**
 * The files a published project shows off: the results its nodes made, pinned
 * results first, then in canvas order (left to right). Text results and
 * anything without a stored file are skipped.
 */
export function pickShowcaseMedia(doc: Pick<GraphDoc, "nodes">, max = SHOWCASE_MAX): ShowcaseItem[] {
  const nodes = [...doc.nodes]
    .filter((n) => n.data.kind !== "group" && n.data.kind !== "comment")
    .sort(
      (a, b) =>
        Number(!!b.data.pinned) - Number(!!a.data.pinned) || a.position.x - b.position.x,
    );
  const seen = new Set<string>();
  const out: ShowcaseItem[] = [];
  for (const n of nodes) {
    for (const o of (n.data.outputs ?? []) as NodeOutput[]) {
      if (o.type === "text" || !o.artifactId || seen.has(o.artifactId)) continue;
      seen.add(o.artifactId);
      out.push({ id: o.artifactId, kind: o.type });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** A post's cover: its first picture, else its first clip. Sound alone has none. */
export function coverOf(media: ShowcaseItem[]): ShowcaseItem | null {
  return media.find((m) => m.kind === "image") ?? media.find((m) => m.kind === "video") ?? null;
}

/** Likes and remixes count; older posts fade, so the page keeps moving. */
export function trendingScore(
  post: { likeCount: number; cloneCount: number; createdAt: Date | string | number },
  now = Date.now(),
): number {
  const hours = Math.max(0, (now - new Date(post.createdAt).getTime()) / 36e5);
  return (post.likeCount * 3 + post.cloneCount * 2 + 1) / Math.pow(hours + 2, 1.3);
}
