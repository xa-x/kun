import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = sql`now()`;

/**
 * Users are provisioned from Supabase Auth: `id` is the auth.users UUID.
 * The legacy SQLite `password_hash` column is gone — Supabase owns secrets.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull().default("Owner"),
    theme: text("theme").notNull().default("system"), // light|dark|system
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  plan: text("plan").notNull().default("free"), // free|pro|team
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
});

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("owner"), // owner|admin|editor|viewer
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    uniqueIndex("memberships_org_user_idx").on(t.orgId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

/**
 * One row per workbook (a canvas of nodes/edges).
 * `graph` stores the full React Flow document: { nodes, edges, viewport }.
 */
export const graphs = pgTable(
  "graphs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().default(""),
    ownerId: text("owner_id"),
    title: text("title").notNull().default("Untitled"),
    graph: jsonb("graph").notNull().default(sql`'{}'::jsonb`),
    publishedGraph: jsonb("published_graph"),
    version: integer("version").notNull().default(1),
    visibility: text("visibility").notNull().default("private"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [index("graphs_org_idx").on(t.orgId, t.updatedAt)],
);

/**
 * One row per graph execution (whole canvas or single node).
 */
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().default(""),
    graphId: text("graph_id").notNull(),
    status: text("status").notNull().default("queued"),
    trigger: text("trigger").notNull().default("manual"),
    only: text("only"),
    snapshot: jsonb("snapshot"),
    input: jsonb("input"),
    idempotencyKey: text("idempotency_key"),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    totalCostUsd: integer("total_cost_usd").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    durationMs: integer("duration_ms"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().default(now),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index("runs_graph_idx").on(t.graphId, t.startedAt),
    index("runs_org_idx").on(t.orgId, t.startedAt),
    index("runs_idem_idx").on(t.orgId, t.idempotencyKey),
  ],
);

export const runNodes = pgTable(
  "run_nodes",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().default(""),
    runId: text("run_id").notNull(),
    graphId: text("graph_id").notNull(),
    nodeId: text("node_id").notNull(),
    status: text("status").notNull().default("idle"),
    output: jsonb("output"),
    error: text("error"),
    model: text("model"),
    provider: text("provider"),
    costUsd: integer("cost_usd").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index("run_nodes_run_idx").on(t.runId),
    index("run_nodes_graph_idx").on(t.graphId, t.createdAt),
  ],
);

export const runEvents = pgTable(
  "run_events",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    runId: text("run_id").notNull(),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    level: text("level").notNull().default("info"),
    nodeId: text("node_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [index("run_events_run_idx").on(t.runId, t.seq)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull().default(""),
    runId: text("run_id"),
    kind: text("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    filename: text("filename").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [index("artifacts_run_idx").on(t.runId), index("artifacts_org_idx").on(t.orgId)],
);

export const credentials = pgTable(
  "credentials",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    provider: text("provider").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [uniqueIndex("credentials_org_provider_idx").on(t.orgId, t.provider)],
);

export const workbookVersions = pgTable(
  "workbook_versions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    graphId: text("graph_id").notNull(),
    label: text("label").notNull().default("snapshot"),
    graph: jsonb("graph").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [index("versions_graph_idx").on(t.graphId, t.createdAt)],
);

export const shares = pgTable(
  "shares",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    graphId: text("graph_id").notNull(),
    token: text("token").notNull(),
    permission: text("permission").notNull().default("view"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [uniqueIndex("shares_token_idx").on(t.token), index("shares_graph_idx").on(t.graphId)],
);

export const schedules = pgTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    graphId: text("graph_id").notNull(),
    cronExpr: text("cron_expr").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    enabled: boolean("enabled").notNull().default(true),
    inputs: jsonb("inputs"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [index("schedules_next_idx").on(t.enabled, t.nextRunAt)],
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    graphId: text("graph_id").notNull(),
    token: text("token").notNull(),
    secret: text("secret").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [uniqueIndex("webhooks_token_idx").on(t.token)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    prefix: text("prefix").notNull(),
    scopes: text("scopes").notNull().default("run,read"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.tokenHash)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("queued"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().default(now),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.runAt)],
);

export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    source: text("source").notNull().default("local"), // builtin|registry|local
    registryId: text("registry_id"),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull().default(""),
    body: text("body").notNull(),
    installs: integer("installs").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    uniqueIndex("skills_org_slug_idx").on(t.orgId, t.slug),
    index("skills_org_idx").on(t.orgId),
  ],
);

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    graphId: text("graph_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
    workbook: jsonb("workbook").notNull(),
    cloneCount: integer("clone_count").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
    publishedBy: text("published_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    uniqueIndex("templates_slug_idx").on(t.slug),
    index("templates_featured_idx").on(t.featured, t.createdAt),
  ],
);

export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    runId: text("run_id"),
    kind: text("kind").notNull(),
    amountUsd: integer("amount_usd").notNull().default(0),
    tokens: integer("tokens").notNull().default(0),
    model: text("model"),
    provider: text("provider"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(now),
  },
  (t) => [index("usage_org_idx").on(t.orgId, t.createdAt)],
);

/** Admin-controlled model policy: enablement, price override, margin. */
export const modelPolicy = pgTable("model_policy", {
  model: text("model").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  /** Micro-USD price override (null = provider-reported cost). */
  pricePerUsd: integer("price_per_usd"),
  /** Markup percentage billed on top of the cost basis. */
  marginPct: integer("margin_pct").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(now),
});

export type ModelPolicyRow = typeof modelPolicy.$inferSelect;

export type GraphRow = typeof graphs.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type RunNodeRow = typeof runNodes.$inferSelect;
export type ArtifactRow = typeof artifacts.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type OrgRow = typeof organizations.$inferSelect;
export type MembershipRow = typeof memberships.$inferSelect;
export type SkillRow = typeof skills.$inferSelect;
export type TemplateRow = typeof templates.$inferSelect;
