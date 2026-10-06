#!/usr/bin/env node
/**
 * Migrate the local SQLite database (.data/kun.db) into Supabase
 * Postgres. Run AFTER `npm run db:push` has created the schema.
 *
 *   DATABASE_URL="postgres://..." node scripts/migrate-to-supabase.mjs
 *
 * - Idempotent: rows are inserted with ON CONFLICT (id) DO NOTHING, so it is
 *   safe to re-run.
 * - Converts ms-epoch integers → timestamptz, 0/1 → boolean, JSON text →
 *   jsonb, and drops the legacy password_hash / sessions data (Supabase Auth
 *   owns credentials and sessions now).
 * - Locks every table down afterwards: RLS enabled, anon/authenticated
 *   revoked. The app connects as the `postgres` role and is unaffected.
 */
import Database from "better-sqlite3";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is required (Supabase → Settings → Database → Connection string).");
  process.exit(1);
}
const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(process.cwd(), ".data", "kun.db");
if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`✗ SQLite database not found at ${SQLITE_PATH}`);
  process.exit(1);
}

/** [table, timestamp cols, jsonb cols, boolean cols, dropped cols] */
const SPEC = [
  ["organizations", ["created_at"], [], [], []],
  ["users", ["created_at"], [], [], ["password_hash"]],
  ["memberships", ["created_at"], [], [], []],
  ["graphs", ["created_at", "updated_at"], ["graph", "published_graph"], [], []],
  ["runs", ["heartbeat_at", "started_at", "finished_at", "created_at"], ["snapshot", "input"], ["cancel_requested"], []],
  ["run_nodes", ["started_at", "finished_at", "created_at"], ["output"], [], []],
  ["run_events", ["created_at"], ["payload"], [], []],
  ["artifacts", ["created_at"], [], [], []],
  ["credentials", ["created_at", "updated_at"], [], [], []],
  ["workbook_versions", ["created_at"], ["graph"], [], []],
  ["shares", ["expires_at", "created_at"], [], [], []],
  ["schedules", ["last_run_at", "next_run_at", "created_at"], ["inputs"], ["enabled"], []],
  ["webhook_endpoints", ["created_at"], [], ["enabled"], []],
  ["api_keys", ["created_at", "last_used_at"], [], [], []],
  ["jobs", ["run_at", "created_at", "started_at", "finished_at"], ["payload"], [], []],
  ["skills", ["created_at", "updated_at"], [], [], []],
  ["templates", ["created_at", "updated_at"], ["tags", "workbook"], ["featured"], []],
  ["usage_ledger", ["created_at"], [], [], []],
  ["model_policy", ["updated_at"], [], ["enabled"], []],
  // `sessions` is intentionally not migrated — Supabase Auth owns sessions.
];

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const sql = postgres(DATABASE_URL, {
  prepare: false,
  ssl: /sslmode=disable/.test(DATABASE_URL) ? false : "require",
});

const toTs = (v) => (v == null ? null : new Date(Number(v)));
const toBool = (v) => Boolean(v);
const toJson = (v) => {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

let totalRows = 0;
for (const [table, tsCols, jsonCols, boolCols, dropped] of SPEC) {
  const exists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table);
  if (!exists) {
    console.log(`– skip ${table} (not in SQLite file)`);
    continue;
  }
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) {
    console.log(`– skip ${table} (empty)`);
    continue;
  }
  const cols = Object.keys(rows[0]).filter((c) => !dropped.includes(c));
  const values = rows.map((r) =>
    cols.map((c) => {
      if (tsCols.includes(c)) return toTs(r[c]);
      if (boolCols.includes(c)) return toBool(r[c]);
      if (jsonCols.includes(c)) return toJson(r[c]);
      return r[c];
    }),
  );
  // Chunk big tables so we stay well under parameter limits.
  const CHUNK = 200;
  for (let i = 0; i < values.length; i += CHUNK) {
    await sql`
      INSERT INTO ${sql(table)} (${sql(cols)})
      VALUES ${sql(values.slice(i, i + CHUNK))}
      ON CONFLICT (id) DO NOTHING
    `.catch((e) => {
      // model_policy has a different PK; fall back to a per-row insert.
      if (table === "model_policy") return;
      throw e;
    });
  }
  if (table === "model_policy") {
    for (let i = 0; i < values.length; i++) {
      await sql`
        INSERT INTO model_policy (${sql(cols)})
        VALUES (${sql(values[i])})
        ON CONFLICT (model) DO NOTHING
      `;
    }
  }
  totalRows += rows.length;
  console.log(`✓ ${table}: ${rows.length} rows`);
}

// Lock down: RLS on, PostgREST roles out. The app connects as `postgres`.
const tables = SPEC.map(([t]) => t);
for (const t of tables) {
  await sql.unsafe(`ALTER TABLE IF EXISTS ${t} ENABLE ROW LEVEL SECURITY`);
  await sql.unsafe(`REVOKE ALL ON ${t} FROM anon, authenticated`);
}
console.log(`🔒 RLS enabled + anon/authenticated revoked on ${tables.length} tables`);

const [{ n: users }] = await sql`SELECT count(*)::int AS n FROM users`;
const [{ n: graphs }] = await sql`SELECT count(*)::int AS n FROM graphs`;
console.log(`\nDone. ${totalRows} rows migrated. users=${users} graphs=${graphs}`);
console.log("Next: the first account you sign up with claims the legacy local workspace.");
await sql.end();
sqlite.close();
