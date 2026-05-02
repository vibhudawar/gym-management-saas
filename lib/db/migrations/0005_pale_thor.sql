CREATE TYPE "public"."reminder_channel" AS ENUM('whatsapp_manual', 'whatsapp_api', 'sms', 'manual');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('contacted', 'responded', 'paid', 'lapsed');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('renewal_14d', 'renewal_7d', 'renewal_3d', 'lapsed_7d', 'lapsed_30d', 'win_back');--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"membership_id" uuid,
	"type" "reminder_type" NOT NULL,
	"channel" "reminder_channel" NOT NULL,
	"status" "reminder_status" DEFAULT 'contacted' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminders_member_sent_idx" ON "reminders" USING btree ("member_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reminders_membership_sent_idx" ON "reminders" USING btree ("membership_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reminders_gym_sent_idx" ON "reminders" USING btree ("gym_id","sent_at" DESC NULLS LAST);