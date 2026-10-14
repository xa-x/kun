"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowsClockwise, MagnifyingGlass, Sparkle, Stack } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import type { FeedEvent, FeedSort, Post } from "@/lib/community-feed";
import { PostCard } from "./PostCard";

const SORTS: { v: FeedSort; label: MessageKey }[] = [
  { v: "trending", label: "shell.community.trending" },
  { v: "new", label: "shell.community.new" },
  { v: "remixed", label: "shell.community.mostRemixed" },
];

/** What people are making with Kun: a feed of published projects and what is happening around them. */
export function CommunityView() {
  const { t, ago } = useI18n();
  const [sort, setSort] = useState<FeedSort>("trending");
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [events, setEvents] = useState<FeedEvent[] | null>(null);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      async () => {
        try {
          const sp = new URLSearchParams({ sort });
          if (tag) sp.set("tag", tag);
          if (q.trim()) sp.set("q", q.trim());
          const res = await fetch(`/api/community?${sp}`);
          if (!res.ok) throw new Error();
          const j = await readJson<{ posts: Post[]; tags: string[] }>(res);
          if (!live) return;
          setPosts(j.posts);
          if (!tag && !q) setTags(j.tags);
          setFailed(false);
        } catch {
          if (live) {
            setFailed(true);
            setPosts((p) => p ?? []);
          }
        }
      },
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [sort, tag, q]);

  useEffect(() => {
    let live = true;
    void fetch("/api/community/activity")
      .then((r) => readJson<{ events: FeedEvent[] }>(r))
      .then((j) => live && setEvents(j.events))
      .catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 md:px-10 md:py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">{t("shell.nav.community")}</h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
          {t("shell.community.description")}
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label={t("shell.community.sort")} className="flex gap-1">
              {SORTS.map((s) => (
                <button
                  key={s.v}
                  type="button"
                  role="tab"
                  aria-selected={sort === s.v}
                  onClick={() => setSort(s.v)}
                  className={`h-9 rounded-full px-4 text-[13px] transition-colors ${
                    sort === s.v ? "bg-ink/10 font-medium text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {t(s.label)}
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-[240px]">
              <MagnifyingGlass size={15} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("shell.home.search")}
                aria-label={t("shell.community.search")}
                dir="auto"
                className="kun-input !h-9 !rounded-full ps-10 !text-[13px]"
              />
            </div>
          </div>

          {tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label={t("shell.community.tags")}>
              {["", ...tags].map((tg) => (
                <button
                  key={tg || "all"}
                  type="button"
                  aria-pressed={tag === tg}
                  onClick={() => setTag(tg)}
                  className={`h-8 rounded-full border px-3.5 text-[12.5px] transition-colors active:scale-[0.97] ${
                    tag === tg ? "border-ink/50 bg-ink/10 text-ink" : "border-line text-muted hover:border-line2 hover:text-ink"
                  }`}
                >
                  {tg ? <bdi>{tg}</bdi> : t("shell.community.everything")}
                </button>
              ))}
            </div>
          )}

          {posts === null ? (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3" aria-busy>
              {[220, 300, 260, 340, 240, 280].map((h, i) => (
                <div key={i} className="kun-skeleton mb-4 break-inside-avoid" style={{ height: h }} />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/8 text-ink">
                <Stack size={22} aria-hidden />
              </span>
              <p className="mt-4 text-[15px] font-medium text-ink">
                {failed ? t("shell.community.loadFailed") : q || tag ? t("shell.community.noMatch") : t("shell.community.empty")}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                {failed
                  ? t("shell.community.refresh")
                  : q || tag
                    ? t("shell.community.tryOther")
                    : t("shell.community.beFirst")}
              </p>
            </div>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </div>

        <aside aria-label={t("shell.community.now")} className="lg:sticky lg:top-8 lg:self-start">
          <h2 className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            {t("shell.community.now")}
          </h2>
          {events === null ? (
            <div className="mt-4 space-y-3" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="kun-skeleton h-11" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="mt-4 text-[13px] leading-relaxed text-muted">{t("shell.community.quiet")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {events.map((e) => (
                <li key={e.id} className="py-3">
                  <p className="text-[13px] leading-snug text-muted">
                    {e.kind === "remixed" ? (
                      <ArrowsClockwise size={12} className="me-1.5 inline -translate-y-px text-faint" aria-hidden />
                    ) : (
                      <Sparkle size={12} weight="fill" className="me-1.5 inline -translate-y-px text-faint" aria-hidden />
                    )}
                    <bdi className="text-ink">{e.who}</bdi> {e.kind === "remixed" ? t("shell.community.remixed") : t("shell.community.published")}{" "}
                    <Link href={`/templates/${e.slug}`} dir="auto" className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                      {e.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-faint">{ago(e.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
