CREATE TYPE "public"."branch_status" AS ENUM('active', 'inactive');--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "salon_name" text;--> statement-breakpoint
UPDATE "branches" SET "salon_name" = "name" WHERE "salon_name" IS NULL;--> statement-breakpoint
ALTER TABLE "branches" ALTER COLUMN "salon_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "gst_number" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "working_hours" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "status" "branch_status" DEFAULT 'active' NOT NULL;