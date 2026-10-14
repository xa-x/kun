import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  apiKeys,
  artifacts,
  communityEvents,
  credentials,
  graphs,
  jobs,
  memberships,
  organizations,
  runEvents,
  runNodes,
  runs,
  savedShares,
  schedules,
  shares,
  skills,
  templateLikes,
  templates,
  webhookEndpoints,
  workbookVersions,
  workspaceInvites,
} from "@/db/schema";
import { objectStore } from "./storage";

/**
 * Remove a workspace and everything in it: projects and their history, files
 * (also from storage), keys, schedules, published posts. The billing ledger
 * stays: it is a financial record, not workspace content.
 */
export async function deleteWorkspace(orgId: string) {
  const files = await db
    .select({ filename: artifacts.filename })
    .from(artifacts)
    .where(eq(artifacts.orgId, orgId));

  const graphIds = (await db.select({ id: graphs.id }).from(graphs).where(eq(graphs.orgId, orgId))).map((g) => g.id);
  const tplIds = (await db.select({ id: templates.id }).from(templates).where(eq(templates.orgId, orgId))).map((t) => t.id);
  const runIds = (await db.select({ id: runs.id }).from(runs).where(eq(runs.orgId, orgId))).map((r) => r.id);

  if (tplIds.length) {
    await db.delete(templateLikes).where(inArray(templateLikes.templateId, tplIds));
    await db.delete(communityEvents).where(inArray(communityEvents.templateId, tplIds));
  }
  if (graphIds.length) await db.delete(savedShares).where(inArray(savedShares.graphId, graphIds));
  if (runIds.length) await db.delete(runEvents).where(inArray(runEvents.runId, runIds));

  await db.delete(runNodes).where(eq(runNodes.orgId, orgId));
  await db.delete(runs).where(eq(runs.orgId, orgId));
  await db.delete(jobs).where(eq(jobs.orgId, orgId));
  await db.delete(schedules).where(eq(schedules.orgId, orgId));
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.orgId, orgId));
  await db.delete(shares).where(eq(shares.orgId, orgId));
  await db.delete(workbookVersions).where(eq(workbookVersions.orgId, orgId));
  await db.delete(templates).where(eq(templates.orgId, orgId));
  await db.delete(graphs).where(eq(graphs.orgId, orgId));
  await db.delete(artifacts).where(eq(artifacts.orgId, orgId));
  await db.delete(skills).where(eq(skills.orgId, orgId));
  await db.delete(credentials).where(eq(credentials.orgId, orgId));
  await db.delete(apiKeys).where(eq(apiKeys.orgId, orgId));
  await db.delete(workspaceInvites).where(eq(workspaceInvites.orgId, orgId));
  await db.delete(memberships).where(eq(memberships.orgId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  // Files last: if storage fails the database is already clean.
  await Promise.all(files.map((f) => objectStore.remove(f.filename).catch(() => {})));
}
