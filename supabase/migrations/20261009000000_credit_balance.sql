-- Prepaid credits: a per-org balance spent after the plan's included monthly
-- credits, the share of each ledger row it paid, and a record of top-ups.
ALTER TABLE "organizations" ADD COLUMN "credit_balance" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "usage_ledger" ADD COLUMN "balance_usd" integer DEFAULT 0 NOT NULL;

CREATE TABLE "credit_topups" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text,
	"amount_usd" integer NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "topups_org_idx" ON "credit_topups" USING btree ("org_id","created_at");

ALTER TABLE credit_topups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_topups FROM anon, authenticated;
