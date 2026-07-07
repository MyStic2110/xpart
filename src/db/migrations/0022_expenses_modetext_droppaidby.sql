ALTER TABLE "expenses" DROP CONSTRAINT "expenses_paid_by_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "payment_mode" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "payment_mode" SET DATA TYPE text USING "payment_mode"::text;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "payment_mode" SET DEFAULT 'Cash';--> statement-breakpoint
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "paid_by_id";--> statement-breakpoint
DROP TYPE "public"."expense_payment_mode";
