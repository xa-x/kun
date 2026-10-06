INSERT INTO "users" ("id", "email", "name", "theme", "created_at") VALUES
('hmyvlb63gb84', 'local@kun.dev', 'Local', 'light', '2026-09-28T18:59:29.000Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;