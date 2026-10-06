CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"scopes" text DEFAULT 'run,read' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT '' NOT NULL,
	"run_id" text,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"filename" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"provider" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graphs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT '' NOT NULL,
	"owner_id" text,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_graph" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_policy" (
	"model" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"price_per_usd" integer,
	"margin_pct" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"node_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT '' NOT NULL,
	"run_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"node_id" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"output" jsonb,
	"error" text,
	"model" text,
	"provider" text,
	"cost_usd" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT '' NOT NULL,
	"graph_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"only" text,
	"snapshot" jsonb,
	"input" jsonb,
	"idempotency_key" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"heartbeat_at" timestamp with time zone,
	"total_cost_usd" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"cron_expr" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"inputs" jsonb,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"token" text NOT NULL,
	"permission" text DEFAULT 'view' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"source" text DEFAULT 'local' NOT NULL,
	"registry_id" text,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"workbook" jsonb NOT NULL,
	"clone_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"published_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_id" text,
	"kind" text NOT NULL,
	"amount_usd" integer DEFAULT 0 NOT NULL,
	"tokens" integer DEFAULT 0 NOT NULL,
	"model" text,
	"provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT 'Owner' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"token" text NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workbook_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"graph_id" text NOT NULL,
	"label" text DEFAULT 'snapshot' NOT NULL,
	"graph" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "artifacts_run_idx" ON "artifacts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "artifacts_org_idx" ON "artifacts" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_org_provider_idx" ON "credentials" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "graphs_org_idx" ON "graphs" USING btree ("org_id","updated_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_org_user_idx" ON "memberships" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "run_events_run_idx" ON "run_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "run_nodes_run_idx" ON "run_nodes" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_nodes_graph_idx" ON "run_nodes" USING btree ("graph_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_graph_idx" ON "runs" USING btree ("graph_id","started_at");--> statement-breakpoint
CREATE INDEX "runs_org_idx" ON "runs" USING btree ("org_id","started_at");--> statement-breakpoint
CREATE INDEX "runs_idem_idx" ON "runs" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "schedules_next_idx" ON "schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_token_idx" ON "shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "shares_graph_idx" ON "shares" USING btree ("graph_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_org_slug_idx" ON "skills" USING btree ("org_id","slug");--> statement-breakpoint
CREATE INDEX "skills_org_idx" ON "skills" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_slug_idx" ON "templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "templates_featured_idx" ON "templates" USING btree ("featured","created_at");--> statement-breakpoint
CREATE INDEX "usage_org_idx" ON "usage_ledger" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhooks_token_idx" ON "webhook_endpoints" USING btree ("token");--> statement-breakpoint
CREATE INDEX "versions_graph_idx" ON "workbook_versions" USING btree ("graph_id","created_at");