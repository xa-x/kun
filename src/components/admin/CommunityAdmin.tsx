"use client";

import { useState } from "react";
import Link from "next/link";
import { ago } from "@/lib/format";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { AdminPage, Badge, SearchBox, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface P {
  slug: string;
  title: string;
  creator: string;
  email: string;
  likes: number;
  remixes: number;
  media: number;
  featured: boolean;
  createdAt: string;
}

export function CommunityAdmin() {
  const [q, setQ] = useState("");
  const { data, error, reload } = useAdminData<{ posts: P[] }>(`/api/admin/community?q=${encodeURIComponent(q)}`);
  const [confirm, setConfirm] = useState<string | null>(null);

  const call = async (slug: string, init: RequestInit, done: string) => {
    const res = await fetch(`/api/admin/community/${slug}`, { headers: { "content-type": "application/json" }, ...init });
    const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    if (!res.ok) return toast(j.error || "Failed", "error");
    toast(done, "ok");
    setConfirm(null);
    await reload();
  };

  return (
    <AdminPage
      title="Community"
      description="Published projects. Feature one to pin it to the top of Trending, or take it down. Taking a post down never touches the author's project."
      actions={<SearchBox value={q} onChange={setQ} placeholder="Search title or author email" />}
    >
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <Table head={["Post", "Author", "Likes", "Remixes", "Files", "Published", ""]} empty={data && data.posts.length === 0 ? "Nothing published." : undefined}>
        {(data?.posts ?? []).map((p) => (
          <tr key={p.slug} className="align-top">
            <td className="px-4 py-3">
              <Link href={`/templates/${p.slug}`} className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                {p.title}
              </Link>{" "}
              {p.featured && <Badge tone="warn">featured</Badge>}
            </td>
            <td className="px-4 py-3">
              <p className="text-ink">{p.creator}</p>
              <p className="text-[12px] text-faint">{p.email}</p>
            </td>
            <td className="px-4 py-3 font-mono tabular-nums">{p.likes}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{p.remixes}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{p.media}</td>
            <td className="px-4 py-3 text-muted">{ago(p.createdAt)}</td>
            <td className="px-4 py-3 text-end">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void call(p.slug, { method: "PATCH", body: JSON.stringify({ featured: !p.featured }) }, p.featured ? "Unfeatured." : "Featured.")}
                  className="kun-btn-secondary h-8 rounded-full px-3.5 text-[12.5px] font-medium"
                >
                  {p.featured ? "Unfeature" : "Feature"}
                </button>
                {confirm === p.slug ? (
                  <button type="button" onClick={() => void call(p.slug, { method: "DELETE" }, "Post removed.")} className="h-8 rounded-full bg-err px-3.5 text-[12.5px] font-medium text-white">
                    Confirm remove
                  </button>
                ) : (
                  <button type="button" onClick={() => setConfirm(p.slug)} className="h-8 rounded-full px-3.5 text-[12.5px] text-muted hover:bg-err/10 hover:text-err">
                    Remove
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}
    </AdminPage>
  );
}
