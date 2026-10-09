import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __kunPg?: postgres.Sql };

function openClient(): postgres.Sql {
  let url = process.env.DATABASE_URL;
  if (!url) {
    // Keep module import cheap (builds, tests); the first real query will fail
    // loudly against localhost instead of a silent import-time crash.
    console.warn("[db] DATABASE_URL not set — falling back to localhost Postgres.");
    url = "postgres://postgres:postgres@localhost:5432/postgres";
  }
  return postgres(url, {
    // prepare:false is required behind the Supabase transaction pooler (pgbouncer)
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: /sslmode=disable/.test(url) ? false : "require",
  });
}

const client = globalForDb.__kunPg ?? openClient();
if (process.env.NODE_ENV !== "production") globalForDb.__kunPg = client;

export const db = drizzle(client, { schema });
