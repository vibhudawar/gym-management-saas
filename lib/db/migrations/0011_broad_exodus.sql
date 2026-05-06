DROP INDEX "payments_gym_date_idx";--> statement-breakpoint
DROP INDEX "payments_gym_branch_date_idx";--> statement-breakpoint
CREATE INDEX "payments_gym_date_idx" ON "payments" USING btree ("gym_id","payment_date") WHERE "payments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "payments_gym_branch_date_idx" ON "payments" USING btree ("gym_id","branch_id","payment_date") WHERE "payments"."deleted_at" is null;