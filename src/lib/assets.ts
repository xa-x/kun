/** Helpers for the Assets library: names, filters and stock-photo mapping. */

export type AssetKind = "image" | "audio" | "video";
export type AssetSource = "upload" | "generated" | "stock";

export const ASSET_KINDS: AssetKind[] = ["image", "audio", "video"];
export const ASSET_SOURCES: AssetSource[] = ["upload", "generated", "stock"];

export function parseKind(raw: string | null | undefined): AssetKind | null {
  return ASSET_KINDS.find((k) => k === raw) ?? null;
}

export function parseSource(raw: string | null | undefined): AssetSource | null {
  return ASSET_SOURCES.find((s) => s === raw) ?? null;
}

export interface StockMeta {
  provider: "unsplash";
  name: string;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
  width?: number;
  height?: number;
}

/** What to call a file: its original name, else what and when. */
export function assetName(row: {
  kind: string;
  meta: unknown;
  createdAt: Date | string | number;
}): string {
  const name =
    row.meta && typeof row.meta === "object" && "name" in row.meta
      ? String((row.meta as { name?: unknown }).name ?? "").trim()
      : "";
  if (name) return name;
  const d = new Date(row.createdAt);
  const when = Number.isNaN(d.getTime())
    ? ""
    : ` · ${d.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
  return `${row.kind[0].toUpperCase()}${row.kind.slice(1)}${when}`;
}

/** The slice of an Unsplash photo object that we use. */
export interface UnsplashPhoto {
  id: string;
  alt_description?: string | null;
  description?: string | null;
  width?: number;
  height?: number;
  urls: { small: string; regular: string; thumb?: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
}

/** Unsplash asks that credit link back with these tracking parameters. */
const UTM = "utm_source=kun&utm_medium=referral";
export const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

export function stockSearchItem(p: UnsplashPhoto) {
  return {
    id: p.id,
    thumb: p.urls.small,
    alt: p.alt_description || p.description || "Photo",
    width: p.width ?? 0,
    height: p.height ?? 0,
    photographer: p.user.name,
    photographerUrl: withUtm(p.user.links.html),
  };
}

export function stockMeta(p: UnsplashPhoto): StockMeta {
  return {
    provider: "unsplash",
    name: (p.alt_description || p.description || `Unsplash ${p.id}`).slice(0, 120),
    photographer: p.user.name,
    photographerUrl: withUtm(p.user.links.html),
    pageUrl: withUtm(p.links.html),
    width: p.width,
    height: p.height,
  };
}
