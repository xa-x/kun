"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, Heart, MusicNotes } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { signInHref } from "@/lib/routes";
import type { Post } from "@/lib/community-feed";
import { toast } from "../Toast";

const tint = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

/** A published project: its picture first, then who made it and how it's doing. */
export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const { t, ago, num } = useI18n();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likeCount);
  const video = useRef<HTMLVideoElement>(null);
  const href = `/templates/${post.slug}`;

  const toggleLike = async () => {
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    try {
      const res = await fetch(`/api/templates/${post.slug}/like`, { method: "POST" });
      if (res.status === 401) {
        setLiked(prev.liked);
        setLikes(prev.likes);
        router.push(signInHref("/community"));
        return;
      }
      const j = await readJson<{ liked: boolean; likeCount: number; error?: string }>(res);
      if (!res.ok) throw new Error(j.error);
      setLiked(j.liked);
      setLikes(j.likeCount);
    } catch {
      setLiked(prev.liked);
      setLikes(prev.likes);
      toast(t("shell.community.likeFailed"), "error");
    }
  };

  const hue = tint(post.id);
  return (
    <article className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-line bg-card/80 transition-colors hover:border-line2">
      <Link href={href} className="block" aria-label={t("shell.community.open", { title: post.title })}>
        {post.cover?.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${post.cover.id}`} alt="" loading="lazy" className="block w-full" />
        ) : post.cover?.kind === "video" ? (
          <video
            ref={video}
            src={`/api/media/${post.cover.id}#t=0.1`}
            muted
            loop
            playsInline
            preload="metadata"
            onMouseEnter={() => void video.current?.play().catch(() => {})}
            onMouseLeave={() => video.current?.pause()}
            className="block w-full"
          />
        ) : (
          <div
            className="flex aspect-[4/3] items-end p-5"
            style={{ background: `radial-gradient(120% 90% at 20% 10%, hsl(${hue} 40% 24%), transparent 70%), hsl(${hue} 18% 12%)` }}
          >
            {post.media.some((m) => m.kind === "audio") && (
              <MusicNotes size={22} weight="duotone" className="text-white/70" aria-hidden />
            )}
          </div>
        )}
      </Link>
      <div className="p-4">
        <h2 className="line-clamp-2 text-[14.5px] font-medium leading-snug text-ink">
          <Link href={href} dir="auto" className="hover:underline hover:decoration-line2 hover:underline-offset-2">
            {post.title}
          </Link>
        </h2>
        <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-muted">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white/90"
              style={{ background: `hsl(${tint(post.creator.name)} 35% 36%)` }}
            >
              {post.creator.name[0]?.toUpperCase()}
            </span>
            <span dir="auto" className="truncate">{post.creator.name}</span>
            <span className="shrink-0 text-faint">· {ago(post.createdAt)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => void toggleLike()}
              aria-pressed={liked}
              aria-label={liked ? t("shell.community.unlike") : t("shell.community.like")}
              className={`flex items-center gap-1 transition-colors active:scale-90 ${liked ? "text-[#e8736b]" : "hover:text-ink"}`}
            >
              <Heart size={14} weight={liked ? "fill" : "regular"} aria-hidden />
              <span className="font-mono tabular-nums">{num(likes)}</span>
            </button>
            <span className="flex items-center gap-1" title={t("shell.community.remixes")}>
              <ArrowsClockwise size={14} aria-hidden />
              <span className="font-mono tabular-nums">{num(post.cloneCount)}</span>
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
