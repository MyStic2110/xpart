CREATE TYPE "public"."points_txn_type" AS ENUM('earn', 'redeem', 'adjust');--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'points';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "points_txn_type" NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"ref_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "redeem_paise_per_point" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
