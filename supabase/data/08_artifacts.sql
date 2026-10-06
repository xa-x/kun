INSERT INTO "artifacts" ("id", "run_id", "kind", "mime_type", "bytes", "filename", "created_at", "org_id") VALUES
('7j6jno6faqdy', NULL, 'image', 'image/jpeg', 290816, 'k9gjw3v0z7pd/7j6jno6faqdy.jpg', '2026-09-28T20:24:09.000Z'::timestamptz, 'k9gjw3v0z7pd'),
('6urt9lrgols2', 'cvbfdadt1ay0', 'image', 'image/jpeg', 336120, 'k9gjw3v0z7pd/6urt9lrgols2.jpg', '2026-09-28T20:38:11.000Z'::timestamptz, 'k9gjw3v0z7pd'),
('7j1okfypt9v0', 'bxvhw7zj0j3s', 'image', 'image/jpeg', 368230, 'k9gjw3v0z7pd/7j1okfypt9v0.jpg', '2026-09-28T20:40:45.000Z'::timestamptz, 'k9gjw3v0z7pd'),
('h7i7lx0qgq3n', '1w17pjiketsr', 'image', 'image/jpeg', 499316, 'k9gjw3v0z7pd/h7i7lx0qgq3n.jpg', '2026-09-28T20:57:28.000Z'::timestamptz, 'k9gjw3v0z7pd'),
('ivqas4exhkm7', 'o7xzq2j3qrjo', 'image', 'image/jpeg', 634237, 'k9gjw3v0z7pd/ivqas4exhkm7.jpg', '2026-09-28T21:01:01.000Z'::timestamptz, 'k9gjw3v0z7pd')
ON CONFLICT ("id") DO NOTHING;