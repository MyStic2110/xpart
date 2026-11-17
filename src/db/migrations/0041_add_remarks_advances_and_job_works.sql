ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "remarks" text;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "advance_amount" integer DEFAULT 0 NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "remarks" text;

CREATE TABLE IF NOT EXISTS "job_card_job_works" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE cascade,
  "job_card_id" uuid NOT NULL REFERENCES "job_cards"("id") ON DELETE cascade,
  "vendor_id" uuid REFERENCES "vendors"("id") ON DELETE set null,
  "vendor_name" text NOT NULL,
  "work_description" text NOT NULL,
  "vendor_cost" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'sent' NOT NULL,
  "vendor_ref" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "job_card_job_works_org_idx" ON "job_card_job_works" ("org_id");
CREATE INDEX IF NOT EXISTS "job_card_job_works_job_card_idx" ON "job_card_job_works" ("job_card_id");

