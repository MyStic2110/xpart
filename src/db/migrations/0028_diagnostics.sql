CREATE TABLE IF NOT EXISTS "diagnostic_faults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"system" text DEFAULT 'unknown' NOT NULL,
	"ecu" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diagnostic_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid,
	"client_id" uuid,
	"vehicle_id" uuid,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"report_type" text DEFAULT 'obd_scan' NOT NULL,
	"status" text DEFAULT 'processed' NOT NULL,
	"engine" text,
	"report_date" date,
	"odometer_km" integer,
	"vin" text,
	"plate_number" text,
	"workshop_name" text,
	"technician_name" text,
	"extracted" jsonb,
	"health_score" integer,
	"system_scores" jsonb,
	"root_causes" jsonb,
	"recommendations" jsonb,
	"summary" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_faults" ADD CONSTRAINT "diagnostic_faults_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_faults" ADD CONSTRAINT "diagnostic_faults_report_id_diagnostic_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."diagnostic_reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_faults" ADD CONSTRAINT "diagnostic_faults_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
