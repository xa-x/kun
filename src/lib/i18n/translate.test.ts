import { describe, expect, it } from "vitest";
import { fromAcceptLanguage, resolveLocale, dirOf } from "./config";
import { interpolate, translate, translatePlural } from "./translate";

describe("locale resolution", () => {
  it("prefers the cookie, then the browser, then English", () => {
    expect(resolveLocale("ar", "en-US")).toBe("ar");
    expect(resolveLocale(undefined, "ar-EG,ar;q=0.9,en;q=0.8")).toBe("ar");
    expect(resolveLocale("fr", "de")).toBe("en");
    expect(resolveLocale(undefined, null)).toBe("en");
  });
  it("honours quality values", () => {
    expect(fromAcceptLanguage("en;q=0.4, ar;q=0.9")).toBe("ar");
  });
  it("sets direction", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
});

describe("translate", () => {
  const en = { hi: "Hello, {name}", only_en: "Only English" };
  const ar = { hi: "مرحبا، {name}" };
  it("fills placeholders and falls back", () => {
    expect(translate(ar, en, "hi", { name: "Sara" })).toBe("مرحبا، Sara");
    expect(translate(ar, en, "only_en")).toBe("Only English");
    expect(translate(ar, en, "missing")).toBe("missing");
    expect(interpolate("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});

describe("translatePlural", () => {
  const en = { projects_one: "{n} project", projects_other: "{n} projects" };
  const ar = {
    projects_zero: "لا مشاريع",
    projects_one: "مشروع واحد",
    projects_two: "مشروعان",
    projects_few: "{n} مشاريع",
    projects_many: "{n} مشروعًا",
    projects_other: "{n} مشروع",
  };
  it("uses English one/other", () => {
    expect(translatePlural("en", en, en, "projects", 1)).toBe("1 project");
    expect(translatePlural("en", en, en, "projects", 3)).toBe("3 projects");
  });
  it("uses Arabic's six forms", () => {
    const t = (n: number) => translatePlural("ar", ar, en, "projects", n);
    expect(t(0)).toBe("لا مشاريع");
    expect(t(1)).toBe("مشروع واحد");
    expect(t(2)).toBe("مشروعان");
    expect(t(5)).toBe("5 مشاريع");
    expect(t(11)).toBe("11 مشروعًا");
    expect(t(100)).toBe("100 مشروع");
  });
});
