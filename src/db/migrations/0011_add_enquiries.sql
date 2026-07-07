CREATE TYPE "public"."enquiry_channel" AS ENUM('sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('pending', 'contacted', 'follow_up', 'converted', 'lost');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid,
	"contact_number" text NOT NULL,
	"client_name" text NOT NULL,
	"email" text,
	"address" text,
	"enquiry_for" text NOT NULL,
	"enquiry_type" text NOT NULL,
	"response" text,
	"date_to_follow" date NOT NULL,
	"source_of_enquiry" text NOT NULL,
	"lead_representative_id" uuid,
	"lead_status" "lead_status" DEFAULT 'pending' NOT NULL,
	"channel" "enquiry_channel" DEFAULT 'sms' NOT NULL,
	"vehicle_number" text,
	"make_id" uuid,
	"model_id" uuid,
	"segment" text,
	"year" integer,
	"color" text,
	"fuel_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_lead_representative_id_users_id_fk" FOREIGN KEY ("lead_representative_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
