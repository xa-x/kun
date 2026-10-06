INSERT INTO "memberships" ("id", "org_id", "user_id", "role", "created_at") VALUES
('1085bw3ozcav', 'k9gjw3v0z7pd', 'hmyvlb63gb84', 'owner', '2026-09-28T18:59:29.000Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;