-- Operator controls: runtime switches and the sign-up allow-list.
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "platform_invites" (
  "email" text PRIMARY KEY,
  "note" text,
  "invited_by" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_invites" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "platform_settings", "platform_invites" FROM anon, authenticated;
