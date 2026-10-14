import type { UnsplashPhoto } from "./assets";

const API = "https://api.unsplash.com";

export const unsplashKey = () => (process.env.UNSPLASH_ACCESS_KEY ?? "").trim();
export const unsplashConfigured = () => unsplashKey().length > 0;

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Client-ID ${unsplashKey()}`, "Accept-Version": "v1" },
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 429) {
    throw Object.assign(new Error("Unsplash is rate-limiting this app. Try again in a bit."), { status: 503 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Unsplash answered ${res.status}.`), { status: 502 });
  }
  return (await res.json()) as T;
}

export const searchPhotos = (query: string, page: number) =>
  call<{ results: UnsplashPhoto[]; total_pages: number }>(
    `/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=24&content_filter=high`,
  );

export const listPhotos = (page: number) =>
  call<UnsplashPhoto[]>(`/photos?page=${page}&per_page=24&order_by=popular`);

export const getPhoto = (id: string) =>
  call<UnsplashPhoto>(`/photos/${encodeURIComponent(id)}`);

/** Unsplash's guidelines: tell them when a photo is actually used. */
export async function trackDownload(downloadLocation: string) {
  if (!downloadLocation.startsWith(`${API}/`)) return;
  await fetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${unsplashKey()}` },
    cache: "no-store",
  }).catch(() => {});
}
