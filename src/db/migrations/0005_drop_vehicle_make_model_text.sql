CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'cng', 'electric', 'hybrid');--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "anniversary" date;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "source_of_client" text;--> statement-breakpoint
ALTER TABLE "job_card_services" ADD COLUMN "qty" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "job_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "service_advisor_id" uuid;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "images" text[];--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "subtotal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "discount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "tax_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_cards" ADD COLUMN "total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_service_advisor_id_users_id_fk" FOREIGN KEY ("service_advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "make";--> statement-breakpoint
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "model";