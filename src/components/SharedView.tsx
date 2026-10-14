"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsersThree, X } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { PageHeader } from "./shell/PageHeader";
import { BookCover } from "./workbooks/BookCover";
import { toast } from "./Toast";

interface Shared {
  id: string;
  token: string;
  title: string;
  ownerName: string;
  lastOpenedAt: string;
  permission: string;
  kinds: string[];
  coverId: string | null;
}

const ACCESS: Record<string, MessageKey> = {
  view: "shell.shared.view",
  fork: "shell.shared.fork",
  edit: "shell.shared.edit",
};

/** Projects other people have shared with you, newest opened first. */
export function SharedView() {
  const { t, ago } = useI18n();
  const [items, setItems] = useState<Shared[] | null>(null);

  useEffect(() => {
    let live = true;
    void fetch("/api/shared")
      .then((r) => readJson<{ shared: Shared[] }>(r))
      .then((j) => live && setItems(j.shared))
      .catch(() => {
        if (live) {
          toast(t("shell.shared.loadFailed"), "error");
          setItems([]);
        }
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (id: string) => {
    setItems((xs) => (xs ?? []).filter((s) => s.id !== id));
    await fetch(`/api/shared?id=${id}`, { method: "DELETE" }).catch(() => {});
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-12">
      <PageHeader
        title={t("shell.nav.shared")}
        description={t("shell.shared.description")}
      />
      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="kun-skeleton h-[220px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/8 text-ink">
            <UsersThree size={22} aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-medium text-ink">{t("shell.shared.emptyTitle")}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
            {t("shell.shared.emptyBody")}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <li key={s.id}>
              <article className="group relative overflow-hidden rounded-2xl border border-line bg-card/80 transition-colors hover:border-line2">
                <div className="relative h-[132px] border-b border-line bg-sunken/70">
                  {s.coverId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/media/${s.coverId}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full p-3">
                      <BookCover kinds={s.kinds} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="truncate text-[15px] font-medium text-ink">
                    <Link href={`/s/${s.token}`} dir="auto" className="after:absolute after:inset-0 after:content-['']">
                      {s.title || t("common.untitled")}
                    </Link>
                  </h2>
                  <p className="mt-1 truncate text-[12.5px] text-muted">
                    {s.ownerName ? t("shell.rail.from", { name: s.ownerName }) : t("shell.shared.link")} · {t(ACCESS[s.permission] ?? "shell.shared.view")}
                  </p>
                  <p className="mt-1 text-[12px] text-faint">{t("shell.shared.opened", { when: ago(s.lastOpenedAt) })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  aria-label={t("shell.shared.removeNamed", { title: s.title || t("common.untitled") })}
                  title={t("shell.shared.remove")}
                  className="absolute end-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/80 opacity-0 backdrop-blur transition-opacity hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={12} weight="bold" aria-hidden />
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
