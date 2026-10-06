#!/usr/bin/env node
/**
 * Dump the local SQLite database (.data/kun.db) into Postgres-flavored
 * SQL files under supabase/data/, ready to be executed against Supabase via
 * the MCP server (execute_sql) — no DATABASE_URL needed.
 *
 *   node scripts/sqlite-to-sql.mjs
 *
 * Transforms: ms-epoch → 'ISO'::timestamptz, 0/1 → true/false,
 * JSON text → 'json'::jsonb, password_hash dropped, sessions skipped.
 * Idempotent: ON CONFLICT DO NOTHING.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SQLITE_PATH = process.env.SQLITE_PATH ?? path.join(process.cwd(), ".data", "kun.db");
const OUT_DIR = path.join(process.cwd(), "supabase", "data");

if (!fs.existsSync(SQLITE_PATH)) {
  console.error(`✗ SQLite database not found at ${SQLITE_PATH}`);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) fs.unlinkSync(path.join(OUT_DIR, f));

/** [order, table, ts cols, jsonb cols, bool cols, dropped cols, conflict key] */
const SPEC = [
  ["01", "organizations", ["created_at"], [], [], [], "id"],
  ["02", "users", ["created_at"], [], [], ["password_hash"], "id"],
  ["03", "memberships", ["created_at"], [], [], [], "id"],
  ["04", "graphs", ["created_at", "updated_at"], ["graph", "published_graph"], [], [], "id"],
  ["05", "runs", ["heartbeat_at", "started_at", "finished_at", "created_at"], ["snapshot", "input"], ["cancel_requested"], [], "id"],
  ["06", "run_nodes", ["started_at", "finished_at", "created_at"], ["output"], [], [], "id"],
  ["07", "run_events", ["created_at"], ["payload"], [], [], "id"],
  ["08", "artifacts", ["created_at"], [], [], [], "id"],
  ["09", "credentials", ["created_at", "updated_at"], [], [], [], "id"],
  ["10", "workbook_versions", ["created_at"], ["graph"], [], [], "id"],
  ["11", "shares", ["expires_at", "created_at"], [], [], [], "id"],
  ["12", "schedules", ["last_run_at", "next_run_at", "created_at"], ["inputs"], ["enabled"], [], "id"],
  ["13", "webhook_endpoints", ["created_at"], [], ["enabled"], [], "id"],
  ["14", "api_keys", ["created_at", "last_used_at"], [], [], [], "id"],
  ["15", "jobs", ["run_at", "created_at", "started_at", "finished_at"], ["payload"], [], [], "id"],
  ["16", "skills", ["created_at", "updated_at"], [], [], [], "id"],
  ["17", "templates", ["created_at", "updated_at"], ["tags", "workbook"], ["featured"], [], "id"],
  ["18", "usage_ledger", ["created_at"], [], [], [], "id"],
  ["19", "model_policy", ["updated_at"], [], ["enabled"], [], "model"],
  // `sessions` intentionally skipped — Supabase Auth owns sessions.
];

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lit = (v, kind) => {
  if (v == null) return "NULL";
  if (kind === "ts") return `${q(new Date(Number(v)).toISOString())}::timestamptz`;
  if (kind === "bool") return v ? "true" : "false";
  if (kind === "json") {
    const obj = typeof v === "object" ? v : (() => { try { return JSON.parse(v); } catch { return null; } })();
    return obj == null ? "NULL" : `${q(JSON.stringify(obj))}::jsonb`;
  }
  return typeof v === "number" ? String(v) : q(v);
};

const MAX_ROWS = 100;
const MAX_BYTES = 256 * 1024;
const sqlite = new Database(SQLITE_PATH, { readonly: true });
let totalRows = 0;

for (const [order, table, tsCols, jsonCols, boolCols, dropped, conflictKey] of SPEC) {
  const exists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(table);
  if (!exists) continue;
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  if (!rows.length) {
    console.log(`– ${table}: empty, skipped`);
    continue;
  }
  // Rebrand the legacy local-owner email to match the claim constant in
  // src/lib/auth.ts (local@kun.dev), so the first signup claims this org.
  if (table === "users") {
    for (const r of rows) if (r.email === "local@flowbook.dev") r.email = "local@kun.dev";
  }
  const cols = Object.keys(rows[0]).filter((c) => !dropped.includes(c));
  const kindOf = (c) =>
    tsCols.includes(c) ? "ts" : boolCols.includes(c) ? "bool" : jsonCols.includes(c) ? "json" : "val";

  const colList = cols.map((c) => `"${c}"`).join(", ");
  const statements = [];
  let batch = [];
  let bytes = 0;
  const flush = () => {
    if (!batch.length) return;
    statements.push(
      `INSERT INTO "${table}" (${colList}) VALUES\n${batch.join(",\n")}\nON CONFLICT ("${conflictKey}") DO NOTHING;`,
    );
    batch = [];
    bytes = 0;
  };
  for (const r of rows) {
    const tuple = `(${cols.map((c) => lit(r[c], kindOf(c))).join(", ")})`;
    batch.push(tuple);
    bytes += tuple.length;
    if (batch.length >= MAX_ROWS || bytes >= MAX_BYTES) flush();
  }
  flush();

  const file = path.join(OUT_DIR, `${order}_${table}.sql`);
  fs.writeFileSync(file, statements.join("\n\n"));
  totalRows += rows.length;
  console.log(`✓ ${table}: ${rows.length} rows → ${path.relative(process.cwd(), file)}`);
}

console.log(`\nDone. ${totalRows} rows dumped to ${OUT_DIR}`);
console.log("Next: execute these files against Supabase via the MCP server, in order.");
sqlite.close();
