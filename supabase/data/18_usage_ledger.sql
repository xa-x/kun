INSERT INTO "usage_ledger" ("id", "org_id", "run_id", "kind", "amount_usd", "tokens", "model", "provider", "created_at") VALUES
('nlhn53bl8aqy', 'k9gjw3v0z7pd', 'i3efq35tumwj', 'run', 150, 472, NULL, NULL, '2026-09-28T19:00:45.000Z'::timestamptz),
('35bxyvbu61fc', 'k9gjw3v0z7pd', 'cvbfdadt1ay0', 'run', 0, 16559, NULL, NULL, '2026-09-28T20:38:11.000Z'::timestamptz),
('54tew8rs2v7k', 'k9gjw3v0z7pd', 'bxvhw7zj0j3s', 'run', 0, 16528, NULL, NULL, '2026-09-28T20:40:45.000Z'::timestamptz),
('7ls772xutbi1', 'k9gjw3v0z7pd', '9o0ty5wqdt5a', 'run', 1470, 2492, NULL, NULL, '2026-09-28T20:47:43.000Z'::timestamptz),
('hr1qx7fhuyrq', 'k9gjw3v0z7pd', 'da522zmtn7w8', 'run', 3089, 4974, NULL, NULL, '2026-09-28T20:55:40.000Z'::timestamptz),
('3ctzr88jcu5y', 'k9gjw3v0z7pd', '1w17pjiketsr', 'run', 0, 16586, NULL, NULL, '2026-09-28T20:57:28.000Z'::timestamptz),
('rtv5f3vdevl3', 'k9gjw3v0z7pd', 'qeh50ms48l5q', 'run', 1729, 4547, NULL, NULL, '2026-09-28T21:00:01.000Z'::timestamptz),
('j0zs6hwy6g5l', 'k9gjw3v0z7pd', 'o7xzq2j3qrjo', 'run', 0, 17156, NULL, NULL, '2026-09-28T21:01:01.000Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;