import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { graphs, memberships, organizations } from "@/db/schema";
import type { MembershipRow, OrgRow } from "@/db/schema";

export class TenantError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "TenantError";
    this.status = status;
  }
}

export function assertOrgAccess(
  actorOrgId: string,
  resourceOrgId: string | null | undefined,
) {
  if (!resourceOrgId || resourceOrgId !== actorOrgId) {
    throw new TenantError("Not found", 404);
  }
}

export function canEdit(role: string) {
  return role === "owner" || role === "admin" || role === "editor";
}

export function canAdmin(role: string) {
  return role === "owner" || role === "admin";
}

export async function membershipFor(userId: string, orgId: string) {
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/** Every workspace the user belongs to, oldest first. */
export async function orgsForUser(userId: string): Promise<
  { org: OrgRow; membership: MembershipRow }[]
> {
  return db
    .select({ org: organizations, membership: memberships })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
}

/**
 * The workspace to act in: the one the user picked (if they still belong to
 * it), otherwise their oldest.
 */
export async function orgForUser(
  userId: string,
  preferredOrgId?: string | null,
): Promise<{ org: OrgRow; membership: MembershipRow } | null> {
  const all = await orgsForUser(userId);
  return all.find((r) => r.org.id === preferredOrgId) ?? all[0] ?? null;
}

export async function requireGraph(orgId: string, graphId: string) {
  const [row] = await db.select().from(graphs).where(eq(graphs.id, graphId)).limit(1);
  if (!row) throw new TenantError("Project not found", 404);
  assertOrgAccess(orgId, row.orgId);
  return row;
}
