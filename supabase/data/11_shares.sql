INSERT INTO "shares" ("id", "org_id", "graph_id", "token", "permission", "expires_at", "created_at") VALUES
('asz1vk41w2uz', 'k9gjw3v0z7pd', 'dd5o5ho2jqoy', 'ja2La-NPUoGT-lWrx4fzn7ux', 'view', NULL, '2026-09-28T19:18:12.000Z'::timestamptz),
('8x9vlkjwp1p7', 'k9gjw3v0z7pd', 'dd5o5ho2jqoy', 'ElhG5XDqVO6cIkAx4b4A3enM', 'view', NULL, '2026-09-28T20:18:55.000Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;