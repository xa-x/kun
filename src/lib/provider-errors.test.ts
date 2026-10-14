import { describe, expect, it, vi } from "vitest";
import {
  isTransient,
  ProviderHttpError,
  transientMessage,
  withRetry,
} from "./provider-errors";

const noSleep = () => Promise.resolve();

describe("isTransient", () => {
  it("treats gateway trouble and rate limits as transient", () => {
    for (const s of [429, 502, 503, 504])
      expect(isTransient(new ProviderHttpError("x", s))).toBe(true);
  });
  it("does not retry client or server errors that will repeat", () => {
    for (const s of [400, 401, 402, 404, 500])
      expect(isTransient(new ProviderHttpError("x", s))).toBe(false);
  });
  it("recognises network failures", () => {
    expect(isTransient(new TypeError("fetch failed"))).toBe(true);
    expect(isTransient(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe(true);
    expect(isTransient(Object.assign(new Error("x"), { statusCode: 503 }))).toBe(true);
  });
  it("leaves ordinary errors alone", () => {
    expect(isTransient(new Error("Model is disabled"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries transient failures then succeeds", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ProviderHttpError("x", 503))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("gives up after the last try", async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderHttpError("x", 503));
    await expect(withRetry(fn, { tries: 2, sleep: noSleep })).rejects.toThrow("x");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("does not retry a permanent error", async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderHttpError("bad key", 401));
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow("bad key");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("transientMessage", () => {
  it("words outages and rate limits differently, and ignores other errors", () => {
    expect(transientMessage(new ProviderHttpError("x", 503))).toMatch(/unreachable/);
    expect(transientMessage(new ProviderHttpError("x", 429))).toMatch(/rate limiting/);
    expect(transientMessage(new Error("nope"))).toBeNull();
  });
});
