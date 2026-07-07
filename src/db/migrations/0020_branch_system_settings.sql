ALTER TABLE "branches" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "google_maps_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "login_bg_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "opening_time" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "closing_time" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "working_days" jsonb;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "extra_hours_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "day_end_report_time" text;