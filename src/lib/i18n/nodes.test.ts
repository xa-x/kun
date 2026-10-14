import { describe, expect, it } from "vitest";
import { MESSAGES, FALLBACK } from "./messages";
import { translate } from "./translate";
import { nodeLabel, portLabel } from "./nodes";
import { NODE_TYPES } from "../nodes";

const tFor = (l: "en" | "ar") => (k: string) => translate(MESSAGES[l], FALLBACK, k);

describe("node text", () => {
  it("translates every node kind and port", () => {
    const t = tFor("ar") as never;
    for (const n of NODE_TYPES) {
      expect(nodeLabel(t, n.type, "")).not.toBe("");
      expect(nodeLabel(t, n.type, "ENGLISH")).not.toBe("ENGLISH");
      for (const p of [...n.inputs, ...n.outputs]) {
        expect(portLabel(t, p.label)).not.toBe(p.label);
      }
    }
  });
  it("keeps English as is", () => {
    expect(portLabel(tFor("en") as never, "First frame")).toBe("First frame");
    expect(nodeLabel(tFor("ar") as never, "unknown.kind", "Custom")).toBe("Custom");
  });
});
