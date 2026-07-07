CREATE TYPE "public"."staff_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."staff_category" AS ENUM('mechanic', 'staff');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'admin' BEFORE 'branch_manager';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"category" "staff_category" NOT NULL,
	"date_of_birth" date,
	"gender" "staff_gender" NOT NULL,
	"working_hours_start" text NOT NULL,
	"working_hours_end" text NOT NULL,
	"monthly_salary" integer NOT NULL,
	"date_of_joining" date NOT NULL,
	"emergency_contact_number" text,
	"emergency_contact_person" text,
	"address" text,
	"id_proof_url" text,
	"photo_url" text,
	"mechanic_type" text,
	"service_commission_pct" numeric(5, 2),
	"product_commission_pct" numeric(5, 2),
	"user_type" text,
	"department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");