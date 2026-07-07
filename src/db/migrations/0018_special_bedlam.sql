ALTER TABLE "branches" ADD COLUMN "loyalty_points_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "points_per_thousand" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "wallet_enabled" boolean DEFAULT true NOT NULL;