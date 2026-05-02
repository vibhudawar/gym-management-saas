CREATE TYPE "public"."freeze_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled_early');--> statement-breakpoint
CREATE TABLE "freezes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"freeze_start_date" date NOT NULL,
	"freeze_end_date" date NOT NULL,
	"actual_end_date" date,
	"days_added" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "freeze_status" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"ended_by_user_id" uuid,
	"early_unfreeze_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "freezes_dates_chk" CHECK ("freezes"."freeze_end_date" >= "freezes"."freeze_start_date"),
	CONSTRAINT "freezes_days_added_chk" CHECK ("freezes"."days_added" >= 1),
	CONSTRAINT "freezes_actual_end_chk" CHECK (("freezes"."actual_end_date" is null) or ("freezes"."actual_end_date" >= "freezes"."freeze_start_date")),
	CONSTRAINT "freezes_cancel_consistency_chk" CHECK (("freezes"."status" = 'cancelled_early') = ("freezes"."ended_by_user_id" is not null and "freezes"."early_unfreeze_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezes" ADD CONSTRAINT "freezes_ended_by_user_id_users_id_fk" FOREIGN KEY ("ended_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freezes_gym_membership_idx" ON "freezes" USING btree ("gym_id","membership_id");--> statement-breakpoint
CREATE INDEX "freezes_gym_status_idx" ON "freezes" USING btree ("gym_id","status");--> statement-breakpoint
CREATE INDEX "freezes_member_start_idx" ON "freezes" USING btree ("member_id","freeze_start_date" DESC NULLS LAST);