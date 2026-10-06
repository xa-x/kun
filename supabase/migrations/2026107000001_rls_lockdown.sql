-- Lock down the public schema for the hosted app:
-- the API server connects as `postgres` (or via the pooler with the DB
-- password) and is unaffected; PostgREST roles (anon / authenticated) get
-- nothing through the Data API.
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS run_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS run_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workbook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS model_policy ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON users, organizations, memberships, graphs, runs, run_nodes,
  run_events, artifacts, credentials, workbook_versions, shares, schedules,
  webhook_endpoints, api_keys, jobs, skills, templates, usage_ledger, model_policy
FROM anon, authenticated;
