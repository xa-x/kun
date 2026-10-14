/**
 * Transient provider failures: classify them, retry the cheap ones, and word
 * the ones that survive so a user knows their project is fine and a re-run
 * is the next step — not a raw provider stack.
 */

/** An HTTP failure from the model provider, for calls made with bare fetch. */
export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

/** Statuses worth another try: rate limit, and upstream/gateway trouble. */
const TRANSIENT_STATUS = new Set([408, 425, 429, 502, 503, 504]);
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

type Loose = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  message?: unknown;
  cause?: unknown;
};

export function statusOf(e: unknown): number | undefined {
  const o = e as Loose | null;
  for (const v of [o?.statusCode, o?.status, (o?.cause as Loose | undefined)?.statusCode]) {
    if (typeof v === "number") return v;
  }
  return undefined;
}

export function isTransient(e: unknown): boolean {
  const status = statusOf(e);
  if (status !== undefined) return TRANSIENT_STATUS.has(status);
  const o = e as Loose | null;
  const code = o?.code ?? (o?.cause as Loose | undefined)?.code;
  if (typeof code === "string" && NETWORK_CODES.has(code)) return true;
  if (o?.name === "TimeoutError" || o?.name === "AbortError") return true;
  // Node's fetch hides the real cause behind this message.
  return typeof o?.message === "string" && /fetch failed|network|socket hang up/i.test(o.message);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Run `fn`, retrying transient failures with exponential backoff and jitter.
 * Only failures that never produced a result are retried, so a retry cannot
 * bill a call that actually succeeded. Anything else is thrown immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const { tries = 3, baseMs = 800, sleep = wait } = opts;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= tries || !isTransient(e)) throw e;
      await sleep(baseMs * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5));
    }
  }
}

/**
 * What a user should read when a node fails for a transient reason, or null
 * when the error is something else (a bad prompt, a disabled model) and the
 * original message is the useful one.
 */
export function transientMessage(e: unknown): string | null {
  if (!isTransient(e)) return null;
  if (statusOf(e) === 429)
    return "The model provider is rate limiting requests right now. Your project is saved — run it again in a minute.";
  return "The model provider is unreachable right now. Your project is saved — run it again in a minute.";
}
