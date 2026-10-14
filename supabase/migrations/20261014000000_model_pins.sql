-- Admin-pinned model suggestions: lower rank shows first; NULL = not pinned.
ALTER TABLE "model_policy" ADD COLUMN "pin_rank" integer;
