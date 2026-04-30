CREATE TYPE "public"."membership_status" AS ENUM('active', 'expired', 'frozen', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'upi', 'card', 'bank_transfer');--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"original_end_date" date NOT NULL,
	"plan_price_paise" integer NOT NULL,
	"addons_total_paise" integer DEFAULT 0 NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"discount_reason" text,
	"final_amount_paise" integer NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"previous_membership_id" uuid,
	"enrolled_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "memberships_end_after_start" CHECK ("memberships"."end_date" >= "memberships"."start_date"),
	CONSTRAINT "memberships_final_non_negative" CHECK ("memberships"."final_amount_paise" >= 0),
	CONSTRAINT "memberships_discount_non_negative" CHECK ("memberships"."discount_paise" >= 0),
	CONSTRAINT "memberships_plan_price_non_negative" CHECK ("memberships"."plan_price_paise" >= 0),
	CONSTRAINT "memberships_addons_non_negative" CHECK ("memberships"."addons_total_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "membership_addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"add_on_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_addons_amount_non_negative" CHECK ("membership_addons"."amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gym_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"payment_mode" "payment_mode" NOT NULL,
	"payment_date" date NOT NULL,
	"invoice_number" text NOT NULL,
	"kind" "payment_kind" DEFAULT 'payment' NOT NULL,
	"refund_of_payment_id" uuid,
	"reason" text,
	"notes" text,
	"received_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "payments_sign_invariant" CHECK (("payments"."kind" = 'payment' and "payments"."amount_paise" > 0) or ("payments"."kind" = 'refund' and "payments"."amount_paise" < 0)),
	CONSTRAINT "payments_refund_link" CHECK (("payments"."kind" = 'refund') = ("payments"."refund_of_payment_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"gym_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_sequences_gym_id_year_pk" PRIMARY KEY("gym_id","year")
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_previous_membership_id_memberships_id_fk" FOREIGN KEY ("previous_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_enrolled_by_user_id_users_id_fk" FOREIGN KEY ("enrolled_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_addons" ADD CONSTRAINT "membership_addons_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_addons" ADD CONSTRAINT "membership_addons_add_on_id_add_ons_id_fk" FOREIGN KEY ("add_on_id") REFERENCES "public"."add_ons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_of_payment_id_payments_id_fk" FOREIGN KEY ("refund_of_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_member_status_idx" ON "memberships" USING btree ("gym_id","member_id","status");--> statement-breakpoint
CREATE INDEX "memberships_gym_branch_status_idx" ON "memberships" USING btree ("gym_id","branch_id","status");--> statement-breakpoint
CREATE INDEX "memberships_member_created_idx" ON "memberships" USING btree ("member_id","created_at");--> statement-breakpoint
CREATE INDEX "memberships_gym_end_date_idx" ON "memberships" USING btree ("gym_id","end_date") WHERE "memberships"."status" = 'active' and "memberships"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "membership_addons_membership_idx" ON "membership_addons" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "payments_gym_date_idx" ON "payments" USING btree ("gym_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_gym_branch_date_idx" ON "payments" USING btree ("gym_id","branch_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_membership_idx" ON "payments" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "payments_member_date_idx" ON "payments" USING btree ("member_id","payment_date");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_invoice_unique" ON "payments" USING btree ("gym_id","invoice_number") WHERE "payments"."deleted_at" is null;