DROP TABLE "feedback" CASCADE;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "images" text[];--> statement-breakpoint
DROP TYPE "public"."feedback_source";