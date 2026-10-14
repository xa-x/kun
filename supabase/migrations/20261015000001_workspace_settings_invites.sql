-- Workspace privacy settings and invite links.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "workspace_invites" (
  "id" text PRIMARY KEY,
  "org_id" text NOT NULL,
  "token" text NOT NULL,
  "role" text NOT NULL DEFAULT 'editor',
  "email" text,
  "created_by" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_token_idx" ON "workspace_invites" ("token");
CREATE INDEX IF NOT EXISTS "workspace_invites_org_idx" ON "workspace_invites" ("org_id");

ALTER TABLE "workspace_invites" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "workspace_invites" FROM anon, authenticated;
