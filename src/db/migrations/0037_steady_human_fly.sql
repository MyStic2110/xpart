CREATE TABLE IF NOT EXISTS "garage_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garage_id" uuid NOT NULL,
	"claimed_by_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_otp" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garage_coverage" (
	"garage_id" uuid PRIMARY KEY NOT NULL,
	"coverage_radius" real DEFAULT 5 NOT NULL,
	"pickup_available" boolean DEFAULT false NOT NULL,
	"roadside_assistance" boolean DEFAULT false NOT NULL,
	"home_service" boolean DEFAULT false NOT NULL,
	"fleet_service" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garage_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garage_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garage_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garage_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"category" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garage_working_hours" (
	"garage_id" uuid PRIMARY KEY NOT NULL,
	"monday_open" text,
	"monday_close" text,
	"tuesday_open" text,
	"tuesday_close" text,
	"wednesday_open" text,
	"wednesday_close" text,
	"thursday_open" text,
	"thursday_close" text,
	"friday_open" text,
	"friday_close" text,
	"saturday_open" text,
	"saturday_close" text,
	"sunday_open" text,
	"sunday_close" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"phone" text,
	"website" text,
	"osm_id" text,
	"google_place_id" text,
	"verified" boolean DEFAULT false NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"rating" real,
	"review_count" integer DEFAULT 0 NOT NULL,
	"service_radius_km" real DEFAULT 5 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "garage_claims" ADD CONSTRAINT "garage_claims_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "garage_coverage" ADD CONSTRAINT "garage_coverage_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "garage_photos" ADD CONSTRAINT "garage_photos_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "garage_services" ADD CONSTRAINT "garage_services_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "garage_working_hours" ADD CONSTRAINT "garage_working_hours_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "garages" ADD CONSTRAINT "garages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
