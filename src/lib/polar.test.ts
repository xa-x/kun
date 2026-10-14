import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhook } from "./polar";

const NOW = 1_800_000_000_000;
const KEY = Buffer.from("a-test-signing-key");
const SECRET = `whsec_${KEY.toString("base64")}`;
const BODY = JSON.stringify({ type: "order.paid", data: { id: "o1" } });

function sign(key: Buffer, body = BODY, ts = NOW / 1000, id = "msg_1") {
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(ts),
    "webhook-signature": `v1,${sig}`,
  });
}

describe("verifyWebhook", () => {
  it("accepts a Standard Webhooks signature", () => {
    expect(verifyWebhook(BODY, sign(KEY), SECRET, NOW)).toBe(true);
  });

  it("accepts the older raw-secret key", () => {
    expect(verifyWebhook(BODY, sign(Buffer.from(SECRET)), SECRET, NOW)).toBe(true);
  });

  it("accepts any matching entry in a rotated header", () => {
    const h = sign(KEY);
    h.set("webhook-signature", `v1,AAAA ${h.get("webhook-signature")}`);
    expect(verifyWebhook(BODY, h, SECRET, NOW)).toBe(true);
  });

  it("rejects a tampered body, a wrong key and a stale timestamp", () => {
    expect(verifyWebhook(BODY + " ", sign(KEY), SECRET, NOW)).toBe(false);
    expect(verifyWebhook(BODY, sign(Buffer.from("other")), SECRET, NOW)).toBe(false);
    expect(verifyWebhook(BODY, sign(KEY, BODY, NOW / 1000 - 600), SECRET, NOW)).toBe(false);
  });

  it("rejects missing headers or secret", () => {
    expect(verifyWebhook(BODY, new Headers(), SECRET, NOW)).toBe(false);
    expect(verifyWebhook(BODY, sign(KEY), "", NOW)).toBe(false);
  });
});
