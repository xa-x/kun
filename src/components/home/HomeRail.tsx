"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, MusicNotes, Play } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { kindLabel } from "../assets/kind";
import type { Post } from "@/lib/community-feed";
import type { Asset } from "../assets/use-assets";

function useFetched<T>(url: string, pick: (j: never) => T) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let live = true;
    void fetch(url)
      .then((r) => readJson(r))
      .then((j) => live && setData(pick(j as never)))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
    // `pick` is a stable inline reader; the url is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return data;
}

function RailHead({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-faint">{title}</h2>
      <Link href={href} className="group flex items-center gap-1 text-[12.5px] text-muted transition-colors hover:text-ink">
        {label}
        <ArrowRight size={11} weight="bold" className="rtl-flip transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}

/** Recent files: a strip of thumbnails that leads to the full library. */
function RecentAssets() {
  const { t } = useI18n();
  const items = useFetched<Asset[]>("/api/assets?limit=6", (j: { assets: Asset[] }) => j.assets);
  return (
    <section aria-label={t("shell.rail.recentAssets")}>
      <RailHead title={t("shell.rail.recentAssets")} href="/assets" label={t("shell.rail.allAssets")} />
      {items === null ? (
        <div className="grid grid-cols-3 gap-2" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kun-skeleton aspect-square" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">
          {t("shell.rail.assetsEmpty")}{" "}
          <Link href="/assets" className="text-ink underline underline-offset-2">
            {t("shell.rail.addFile")}
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href="/assets"
                aria-label={`${a.name}, ${kindLabel(t, a.kind)}`}
                className="relative block aspect-square overflow-hidden rounded-lg border border-line bg-sunken transition-colors hover:border-line2"
              >
                {a.kind === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
                {a.kind === "video" && (
                  <>
                    <video src={`${a.url}#t=0.1`} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                    <span className="absolute start-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white">
                      <Play size={9} weight="fill" aria-hidden />
                    </span>
                  </>
                )}
                {a.kind === "audio" && (
                  <span className="flex h-full w-full items-center justify-center text-[#e6967a]">
                    <MusicNotes size={20} weight="duotone" aria-hidden />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Shared {
  id: string;
  token: string;
  title: string;
  ownerName: string;
  lastOpenedAt: string;
}

function SharedList() {
  const { t, ago } = useI18n();
  const items = useFetched<Shared[]>("/api/shared", (j: { shared: Shared[] }) => j.shared);
  return (
    <section aria-label={t("shell.nav.shared")}>
      <RailHead title={t("shell.nav.shared")} href="/shared" label={t("shell.rail.seeAll")} />
      {items === null ? (
        <div className="space-y-2" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="kun-skeleton h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">{t("shell.rail.sharedEmpty")}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.slice(0, 3).map((s) => (
            <li key={s.id}>
              <Link href={`/s/${s.token}`} className="block py-2.5 transition-colors hover:bg-ink/[0.03]">
                <span dir="auto" className="block truncate text-[13.5px] text-ink">{s.title || t("common.untitled")}</span>
                <span className="block truncate text-[12px] text-faint">
                  {s.ownerName ? `${t("shell.rail.from", { name: s.ownerName })} · ` : ""}
                  {ago(s.lastOpenedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommunityPicks() {
  const { t } = useI18n();
  const posts = useFetched<Post[]>("/api/community?sort=trending&limit=3", (j: { posts: Post[] }) => j.posts);
  if (posts && posts.length === 0) return null;
  return (
    <section aria-label={t("shell.rail.community")}>
      <RailHead title={t("shell.rail.community")} href="/community" label={t("shell.rail.explore")} />
      {posts === null ? (
        <div className="space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="kun-skeleton h-14" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/templates/${p.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-ink/[0.04]">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-sunken">
                  {p.cover?.kind === "image" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/media/${p.cover.id}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {p.cover?.kind === "video" && (
                    <video src={`/api/media/${p.cover.id}#t=0.1`} muted preload="metadata" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block truncate text-[13.5px] text-ink">{p.title}</span>
                  <span className="flex items-center gap-2 truncate text-[12px] text-faint">
                    <bdi>{p.creator.name}</bdi>
                    <span className="flex items-center gap-0.5">
                      <Heart size={11} aria-hidden />
                      {p.likeCount}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Beside the projects: files, things shared with you, and what the community is making. */
export function HomeRail() {
  return (
    <div className="space-y-9">
      <RecentAssets />
      <SharedList />
      <CommunityPicks />
    </div>
  );
}
