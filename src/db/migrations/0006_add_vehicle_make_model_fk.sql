ALTER TABLE "vehicles" ADD COLUMN "make_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "model_id" uuid;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "segment" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "fuel_type" "fuel_type";--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "odometer_reading" integer;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "next_service_date" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_make_id_vehicle_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."vehicle_makes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
