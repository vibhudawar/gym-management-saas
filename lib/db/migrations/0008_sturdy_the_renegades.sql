CREATE TYPE "public"."notification_channel_config" AS ENUM('sms', 'whatsapp', 'sms+whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_provider" AS ENUM('stub', 'msg91');--> statement-breakpoint
CREATE TYPE "public"."notification_event_type" AS ENUM('enrollment', 'renewal', 'refund', 'correction', 'cancellation');--> statement-breakpoint
CREATE TYPE "public"."notification_outbound_channel" AS ENUM('sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_trigger_entity_type" AS ENUM('membership', 'payment');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"event_type" "notification_event_type" NOT NULL,
	"trigger_entity_type" "notification_trigger_entity_type" NOT NULL,
	"trigger_entity_id" uuid NOT NULL,
	"channel" "notification_outbound_channel" NOT NULL,
	"recipient_phone" text NOT NULL,
	"template_key" text NOT NULL,
	"message_body" text NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_attempts_chk" CHECK ("notifications"."attempt_count" >= 0 and "notifications"."attempt_count" <= 5)
);
--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "notification_channel" "notification_channel_config" DEFAULT 'sms' NOT NULL;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "notification_provider" "notification_provider" DEFAULT 'stub' NOT NULL;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "sender_id" text;--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "whatsapp_template_namespace" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_member_idx" ON "notifications" USING btree ("gym_id","member_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_provider_msg_idx" ON "notifications" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "notifications_gym_created_idx" ON "notifications" USING btree ("gym_id","created_at" DESC NULLS LAST);