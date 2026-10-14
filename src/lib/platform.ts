import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformInvites, platformSettings } from "@/db/schema";
import { isInvited as isEnvInvited } from "./admin";
import { SIGNUP_OPEN } from "./signup-mode";

/** Switches an operator controls from /admin/settings. */
export interface PlatformSettings {
  /** Anyone may create an account (overrides the build-time default). */
  signupOpen: boolean;
  /** New runs are refused, with this message. */
  maintenance: { on: boolean; message: string };
  /** A banner shown at the top of the signed-in app. */
  announcement: { on: boolean; text: string; level: "info" | "warn" };
}

export const DEFAULT_PLATFORM: PlatformSettings = {
  signupOpen: SIGNUP_OPEN,
  maintenance: { on: false, message: "Kun is being updated. New runs will work again shortly." },
  announcement: { on: false, text: "", level: "info" },
};

const KEY = "platform";
let cache: { at: number; value: PlatformSettings } | null = null;
const TTL = 10_000;

/** Read stored settings, ignoring anything malformed. */
export function parsePlatform(raw: unknown): PlatformSettings {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const m = (o.maintenance ?? {}) as Record<string, unknown>;
  const a = (o.announcement ?? {}) as Record<string, unknown>;
  return {
    signupOpen: typeof o.signupOpen === "boolean" ? o.signupOpen : DEFAULT_PLATFORM.signupOpen,
    maintenance: {
      on: m.on === true,
      message:
        typeof m.message === "string" && m.message.trim()
          ? m.message.trim().slice(0, 200)
          : DEFAULT_PLATFORM.maintenance.message,
    },
    announcement: {
      on: a.on === true && typeof a.text === "string" && a.text.trim().length > 0,
      text: typeof a.text === "string" ? a.text.trim().slice(0, 240) : "",
      level: a.level === "warn" ? "warn" : "info",
    },
  };
}

/** Merge an admin's edit into the current settings, keeping only valid fields. */
export function patchPlatform(cur: PlatformSettings, patch: unknown): PlatformSettings {
  const p = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const merged: Record<string, unknown> = { ...cur };
  if (typeof p.signupOpen === "boolean") merged.signupOpen = p.signupOpen;
  if (p.maintenance && typeof p.maintenance === "object") merged.maintenance = { ...cur.maintenance, ...(p.maintenance as object) };
  if (p.announcement && typeof p.announcement === "object") merged.announcement = { ...cur.announcement, ...(p.announcement as object) };
  return parsePlatform(merged);
}

export async function platform(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  let value = DEFAULT_PLATFORM;
  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, KEY)).limit(1);
    value = parsePlatform(row?.value);
  } catch {
    // If the table is unreachable, fall back to safe defaults rather than blocking everyone.
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function savePlatform(next: PlatformSettings) {
  await db
    .insert(platformSettings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: next, updatedAt: new Date() } });
  cache = { at: Date.now(), value: next };
}

/** May this email create an account? Open sign-up, the env list, or the admin-managed list. */
export async function canSignUp(email?: string | null): Promise<boolean> {
  if ((await platform()).signupOpen) return true;
  if (isEnvInvited(email)) return true;
  if (!email) return false;
  const [row] = await db
    .select({ email: platformInvites.email })
    .from(platformInvites)
    .where(eq(platformInvites.email, email.trim().toLowerCase()))
    .limit(1);
  return Boolean(row);
}
