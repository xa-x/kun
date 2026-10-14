-- Polar as payment provider: which customer and subscription back an org's
-- plan, and the order behind each top-up so a redelivered webhook can't
-- credit it twice.
ALTER TABLE "organizations" ADD COLUMN "polar_customer_id" text;
ALTER TABLE "organizations" ADD COLUMN "polar_subscription_id" text;
ALTER TABLE "credit_topups" ADD COLUMN "ref" text;
CREATE UNIQUE INDEX "topups_ref_idx" ON "credit_topups" USING btree ("ref");
