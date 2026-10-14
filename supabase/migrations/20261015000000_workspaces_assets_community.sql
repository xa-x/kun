-- Workspaces: a user can own several; remember who made each.
ALTER TABLE "organizations" ADD COLUMN "created_by" text;

-- Assets: where a file came from, plus provider details (e.g. Unsplash credit).
ALTER TABLE "artifacts" ADD COLUMN "source" text NOT NULL DEFAULT 'generated';
ALTER TABLE "artifacts" ADD COLUMN "meta" jsonb;
UPDATE "artifacts" SET "source" = 'upload' WHERE "run_id" IS NULL;

-- Community: published projects carry a cover and a few showcase files.
ALTER TABLE "templates" ADD COLUMN "cover_id" text;
ALTER TABLE "templates" ADD COLUMN "media" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "templates" ADD COLUMN "like_count" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "template_likes" (
  "template_id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("template_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "community_events" (
  "id" text PRIMARY KEY,
  "kind" text NOT NULL,            -- published | remixed
  "template_id" text NOT NULL,
  "user_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "community_events_created_idx" ON "community_events" ("created_at" DESC);

-- Projects other people shared with me (a share link I opened while signed in).
CREATE TABLE IF NOT EXISTS "saved_shares" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "graph_id" text NOT NULL,
  "token" text NOT NULL,
  "title" text NOT NULL DEFAULT 'Untitled',
  "owner_name" text NOT NULL DEFAULT '',
  "last_opened_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_shares_user_graph_idx" ON "saved_shares" ("user_id", "graph_id");

ALTER TABLE "template_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_shares" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "template_likes", "community_events", "saved_shares" FROM anon, authenticated;
