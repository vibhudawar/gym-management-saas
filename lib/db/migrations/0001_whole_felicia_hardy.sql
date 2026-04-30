CREATE TYPE "public"."add_on_type" AS ENUM('one_time', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('general', 'cardio', 'gym_cardio', 'custom');--> statement-breakpoint
CREATE TABLE "add_ons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"type" "add_on_type" NOT NULL,
	"auto_apply_on_first_enrollment" boolean DEFAULT false NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "add_ons_amount_non_negative" CHECK ("add_ons"."amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"name" text NOT NULL,
	"duration_days" integer NOT NULL,
	"type" "plan_type" NOT NULL,
	"default_price_paise" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "plans_duration_positive" CHECK ("plans"."duration_days" > 0),
	CONSTRAINT "plans_price_non_negative" CHECK ("plans"."default_price_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "add_ons" ADD CONSTRAINT "add_ons_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "add_ons_gym_active_idx" ON "add_ons" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "add_ons_gym_name_unique" ON "add_ons" USING btree ("gym_id",lower("name")) WHERE "add_ons"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "plans_gym_active_idx" ON "plans" USING btree ("gym_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_gym_name_unique" ON "plans" USING btree ("gym_id",lower("name")) WHERE "plans"."deleted_at" is null;