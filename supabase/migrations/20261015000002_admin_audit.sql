-- Record of what platform admins change.
CREATE TABLE IF NOT EXISTS "admin_audit" (
  "id" text PRIMARY KEY,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "detail" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "admin_audit_created_idx" ON "admin_audit" ("created_at" DESC);
ALTER TABLE "admin_audit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "admin_audit" FROM anon, authenticated;
