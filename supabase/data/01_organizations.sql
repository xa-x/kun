INSERT INTO "organizations" ("id", "name", "slug", "plan", "created_at") VALUES
('k9gjw3v0z7pd', 'Personal', 'personal', 'pro', '2026-09-28T18:59:29.000Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;