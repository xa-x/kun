import { describe, expect, it } from "vitest";
import { assetName, parseKind, parseSource, stockMeta, withUtm, type UnsplashPhoto } from "./assets";

const photo: UnsplashPhoto = {
  id: "abc",
  alt_description: "a quiet harbour at dawn",
  width: 4000,
  height: 3000,
  urls: { small: "s", regular: "r" },
  links: { html: "https://unsplash.com/photos/abc", download_location: "https://api.unsplash.com/photos/abc/download" },
  user: { name: "Mira Okafor", links: { html: "https://unsplash.com/@mira" } },
};

describe("assets", () => {
  it("parses filters and ignores junk", () => {
    expect(parseKind("video")).toBe("video");
    expect(parseKind("gif")).toBeNull();
    expect(parseSource("stock")).toBe("stock");
    expect(parseSource(undefined)).toBeNull();
  });

  it("names a file by its original name, else by kind and date", () => {
    expect(assetName({ kind: "image", meta: { name: "logo.png" }, createdAt: new Date() })).toBe("logo.png");
    expect(assetName({ kind: "audio", meta: null, createdAt: new Date("2026-10-04T10:00:00Z") })).toMatch(/^Audio · /);
  });

  it("credits the photographer with tracked links", () => {
    const m = stockMeta(photo);
    expect(m.photographerUrl).toBe("https://unsplash.com/@mira?utm_source=kun&utm_medium=referral");
    expect(m.name).toBe("a quiet harbour at dawn");
    expect(withUtm("https://x.test/?a=1")).toBe("https://x.test/?a=1&utm_source=kun&utm_medium=referral");
  });
});
