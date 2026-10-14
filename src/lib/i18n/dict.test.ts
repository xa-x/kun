import { describe, expect, it } from "vitest";
import { en } from "./dict/en";
import { ar } from "./dict/ar";

const AR_FORMS = ["zero", "one", "two", "few", "many", "other"];

describe("dictionaries", () => {
  it("translates every English key into Arabic", () => {
    const missing = Object.keys(en).filter((k) => !(k in ar) || !String(ar[k as keyof typeof ar]).trim());
    expect(missing).toEqual([]);
  });

  it("gives every plural all six Arabic forms", () => {
    const bases = Object.keys(en)
      .filter((k) => k.endsWith("_other"))
      .map((k) => k.slice(0, -"_other".length));
    const incomplete = bases.filter((b) => AR_FORMS.some((f) => !(`${b}_${f}` in ar)));
    expect(incomplete).toEqual([]);
  });

  it("keeps placeholders identical across languages", () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const bad = Object.keys(en).filter((k) => {
      const a = (ar as Record<string, string>)[k];
      // Arabic singular/dual forms may drop {n}; every other placeholder must survive.
      return a && slots(a.replace(/\{n\}/g, "")) !== slots((en as Record<string, string>)[k].replace(/\{n\}/g, ""));
    });
    expect(bad).toEqual([]);
  });
});
