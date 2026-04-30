ALTER TABLE "memberships" ADD COLUMN "corrected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "corrected_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "correction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "corrected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "corrected_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "correction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_corrected_by_user_id_users_id_fk" FOREIGN KEY ("corrected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;