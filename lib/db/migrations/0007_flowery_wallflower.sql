ALTER TABLE "freezes" DROP CONSTRAINT "freezes_days_added_chk";--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_days_added_chk" CHECK ("freezes"."days_added" >= 0);