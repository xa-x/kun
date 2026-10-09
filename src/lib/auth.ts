import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  apiKeys,
  artifacts,
  graphs,
  memberships,
  organizations,
  runNodes,
  runs,
  users,
} from "@/db/schema";
import { hashToken } from "./crypto";
import { newId } from "./ids";
import { isInvited, isPlatformAdmin } from "./admin";
import { SIGNUP_OPEN } from "./signup-mode";
import { orgForUser, type TenantError } from "./tenant";
import type { MembershipRow, OrgRow, UserRow } from "@/db/schema";
import { createSupabaseServerClient, supabaseConfigured } from "./supabase";

/** Legacy cookie from the pre-Supabase auth — cleared on logout. */
export const SESSION_COOKIE = "kun_session";

export interface Actor {
  user: UserRow;
  org: OrgRow;
  membership: MembershipRow;
  via: "session" | "api_key" | "local";
  /** Set for API keys only — what the key is allowed to do. */
  scopes?: string[];
}

export const KEY_SCOPES = ["read", "run", "write", "mcp"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];

interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

const LEGACY_LOCAL_EMAIL = "local@kun.dev";

/**
 * Idempotently mirror a Supabase Auth user into our `users` table. Null when
 * sign-up is closed and this is a new, uninvited account.
 */
async function ensureUserRow(u: AuthUser): Promise<UserRow | null> {
  const [existing] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
  if (existing) return existing;
  if (!SIGNUP_OPEN && !isInvited(u.email)) return null;
  const email = (u.email ?? `${u.id}@supabase.local`).trim().toLowerCase();
  const [row] = await db
    .insert(users)
    .values({
      id: u.id,
      email,
      name: (typeof u.name === "string" && u.name.trim()) || email.split("@")[0],
    })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  const [again] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
  return again!;
}

/** Re-point unassigned rows at an org (legacy local-first data). */
export async function backfillOrphanRows(orgId: string, ownerId: string) {
  await db
    .update(graphs)
    .set({ orgId })
    .where(or(eq(graphs.orgId, ""), isNull(graphs.orgId)));
  await db.update(graphs).set({ ownerId }).where(isNull(graphs.ownerId));
  await db.update(runs).set({ orgId }).where(or(eq(runs.orgId, ""), isNull(runs.orgId)));
  await db
    .update(runNodes)
    .set({ orgId })
    .where(or(eq(runNodes.orgId, ""), isNull(runNodes.orgId)));
  await db
    .update(artifacts)
    .set({ orgId })
    .where(or(eq(artifacts.orgId, ""), isNull(artifacts.orgId)));
}

/**
 * Give a freshly-signed-in user a workspace. If the SQLite migration carried
 * over the local-first bootstrap org (its only member is local@kun.dev),
 * the first real account claims it — workbooks, runs, and artifacts included.
 * Once anyone else is a member it is taken, and later accounts get their own
 * empty workspace.
 */
async function ensureWorkspace(userId: string) {
  const existing = await orgForUser(userId);
  if (existing) return existing;

  const legacy = await db
    .select({ org: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(users.email, LEGACY_LOCAL_EMAIL))
    .limit(1);
  const claimedBy = legacy[0]
    ? await db
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.orgId, legacy[0].org.id),
            ne(users.email, LEGACY_LOCAL_EMAIL),
          ),
        )
        .limit(1)
    : [];
  if (legacy[0] && !claimedBy.length) {
    await db
      .insert(memberships)
      .values({ id: newId(), orgId: legacy[0].org.id, userId, role: "owner" })
      .onConflictDoNothing();
    await backfillOrphanRows(legacy[0].org.id, userId);
    const claimed = await orgForUser(userId);
    if (claimed) return claimed;
  }

  const orgId = newId();
  await db.insert(organizations).values({
    id: orgId,
    name: "Personal",
    slug: `org-${orgId}`,
    plan: "free",
  });
  await db
    .insert(memberships)
    .values({ id: newId(), orgId, userId, role: "owner" })
    .onConflictDoNothing();
  const fresh = await orgForUser(userId);
  return fresh!;
}

async function actorFromSupabaseSession(u: AuthUser): Promise<Actor | null> {
  const user = await ensureUserRow(u);
  if (!user) return null;
  const ctx = await ensureWorkspace(user.id);
  return { user, org: ctx.org, membership: ctx.membership, via: "session" };
}

async function actorFromApiKey(raw: string): Promise<Actor | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.tokenHash, hashToken(raw)))
    .limit(1);
  if (!key) return null;
  const [user] = await db.select().from(users).where(eq(users.id, key.userId)).limit(1);
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, key.orgId))
    .limit(1);
  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, key.userId), eq(memberships.orgId, key.orgId)))
    .limit(1);
  if (!user || !org || !membership) return null;
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));
  const scopes = key.scopes.split(",").map((s) => s.trim()).filter(Boolean);
  return { user, org, membership, via: "api_key", scopes };
}

/**
 * What an API key must hold to make this request. `null` means the route is
 * session-only: keys can't mint keys, change the plan or reach the admin API.
 */
function scopeFor(req: NextRequest): KeyScope | null {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/mcp")) return "mcp";
  if (req.method === "GET" || req.method === "HEAD") return "read";
  if (
    path.startsWith("/api/keys") ||
    path.startsWith("/api/billing") ||
    path.startsWith("/api/admin") ||
    path.startsWith("/api/auth")
  ) {
    return null;
  }
  if (path === "/api/run" || path.startsWith("/api/runs")) return "run";
  return "write";
}

export async function resolveActor(req?: NextRequest): Promise<Actor | null> {
  const header = req?.headers.get("authorization");
  if (header?.startsWith("Bearer kun_")) {
    const viaKey = await actorFromApiKey(header.slice(7));
    if (viaKey) return viaKey;
  }
  if (!supabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return actorFromSupabaseSession({
    id: user.id,
    email: user.email,
    name: (user.user_metadata as { name?: string } | null)?.name,
  });
}

/** Hosted SaaS: every request needs a signed-in user or an API key. */
export async function requireActor(req?: NextRequest): Promise<Actor> {
  const actor = await resolveActor(req);
  if (!actor) {
    throw Object.assign(new Error("Sign in required"), { status: 401 });
  }
  if (req && actor.via === "api_key") {
    const need = scopeFor(req);
    if (!need) {
      throw Object.assign(new Error("This action needs a signed-in session, not an API key."), {
        status: 403,
      });
    }
    if (!actor.scopes?.includes(need)) {
      throw Object.assign(new Error(`This API key is missing the "${need}" scope.`), {
        status: 403,
      });
    }
  }
  return actor;
}

export const ensureActor = requireActor;

export async function signup(email: string, password: string, name?: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@") || password.length < 6) {
    throw Object.assign(new Error("Valid email and 6+ character password required"), {
      status: 400,
    });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: { data: { name: name?.trim() || undefined } },
  });
  if (error) {
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  if (!data.session) {
    // Email confirmation is enabled on the project — ask them to confirm.
    return { needsConfirmation: true as const };
  }
  await actorFromSupabaseSession({
    id: data.user!.id,
    email: data.user!.email,
    name: name?.trim() || undefined,
  });
  return { needsConfirmation: false as const };
}

export async function login(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    throw Object.assign(new Error(error?.message || "Invalid email or password"), {
      status: 401,
    });
  }
  const actor = await actorFromSupabaseSession({
    id: data.user.id,
    email: data.user.email,
    name: (data.user.user_metadata as { name?: string } | null)?.name,
  });
  if (!actor) {
    await supabase.auth.signOut();
    throw Object.assign(
      new Error("This account hasn't been invited yet — sign-up is invite-only for now."),
      { status: 403 },
    );
  }
  return { actor };
}

export async function destroySession() {
  if (!supabaseConfigured()) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export function publicActor(actor: Actor) {
  return {
    user: { id: actor.user.id, email: actor.user.email, name: actor.user.name, theme: actor.user.theme },
    org: { id: actor.org.id, name: actor.org.name, plan: actor.org.plan },
    role: actor.membership.role,
    platformAdmin: isPlatformAdmin(actor.user.email),
  };
}

export function fail(err: unknown) {
  const status =
    typeof err === "object" && err && "status" in err
      ? Number((err as TenantError).status) || 500
      : 500;
  const message = err instanceof Error ? err.message : "Request failed";
  return NextResponse.json({ error: message }, { status });
}
