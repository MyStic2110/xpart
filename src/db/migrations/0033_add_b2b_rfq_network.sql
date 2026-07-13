CREATE TABLE IF NOT EXISTS "parts_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"brand" text NOT NULL,
	"price" integer NOT NULL,
	"delivery_time" text NOT NULL,
	"warranty" text,
	"contact_details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parts_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"vehicle_info" text NOT NULL,
	"part_name" text NOT NULL,
	"oem_number" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"urgency" text NOT NULL,
	"delivery_location" text NOT NULL,
	"preferred_brand" text,
	"max_budget" integer,
	"status" text DEFAULT 'broadcasted' NOT NULL,
	"is_emergency" boolean DEFAULT false NOT NULL,
	"search_radius_km" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "gst_number" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "years_in_business" integer;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "rating" numeric DEFAULT '4.5';--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "genuine_certification" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "return_policy" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "specialization" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "latitude" numeric;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "longitude" numeric;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parts_quotes" ADD CONSTRAINT "parts_quotes_request_id_parts_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."parts_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parts_quotes" ADD CONSTRAINT "parts_quotes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parts_requests" ADD CONSTRAINT "parts_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parts_requests" ADD CONSTRAINT "parts_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
