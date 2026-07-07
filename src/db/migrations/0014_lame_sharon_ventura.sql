ALTER TABLE "job_cards" ADD COLUMN "applied_offer_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_applied_offer_id_offers_id_fk" FOREIGN KEY ("applied_offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
