CREATE TYPE "public"."member_gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"gender" "member_gender",
	"dob" date,
	"address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"notes" text,
	"joined_date" date DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "members_name_length" CHECK (char_length("members"."name") between 2 and 80),
	CONSTRAINT "members_phone_format" CHECK ("members"."phone" ~ '^\+[1-9]\d{6,14}$'),
	CONSTRAINT "members_emergency_phone_format" CHECK ("members"."emergency_contact_phone" is null or "members"."emergency_contact_phone" ~ '^\+[1-9]\d{6,14}$'),
	CONSTRAINT "members_email_format" CHECK ("members"."email" is null or "members"."email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_gym_phone_unique" ON "members" USING btree ("gym_id","phone") WHERE "members"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "members_gym_branch_active_idx" ON "members" USING btree ("gym_id","branch_id","is_active");--> statement-breakpoint
CREATE INDEX "members_gym_idx" ON "members" USING btree ("gym_id");