CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"name" text NOT NULL,
	"company" text,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"name" text NOT NULL,
	"sku" text,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"trade_cost" numeric(12, 2),
	"pack_size" integer,
	"supplier" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"material_id" integer,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_id" integer NOT NULL,
	"master_project_id" integer,
	"trade_type" text DEFAULT 'decking' NOT NULL,
	"site_address" text,
	"notes" text,
	"length_m" numeric(10, 3) NOT NULL,
	"width_m" numeric(10, 3) NOT NULL,
	"height_m" numeric(10, 3) DEFAULT '0.6' NOT NULL,
	"board_width_mm" integer DEFAULT 90 NOT NULL,
	"joist_spacing_mm" integer DEFAULT 450 NOT NULL,
	"bearer_spacing_mm" integer DEFAULT 1800 NOT NULL,
	"post_spacing_mm" integer DEFAULT 1800 NOT NULL,
	"wastage_factor" numeric(5, 3) DEFAULT '1.1' NOT NULL,
	"labour_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
	"labour_rate" numeric(10, 2) DEFAULT '85' NOT NULL,
	"materials_subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"labour_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gst" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"spec_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_id" integer NOT NULL,
	"builder_margin_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"materials_subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"labour_subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"margin_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gst" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"title" text NOT NULL,
	"customer_id" integer,
	"quote_id" integer,
	"site_address" text,
	"notes" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"photos" json DEFAULT '[]'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"team_member_id" integer NOT NULL,
	"role_on_job" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"role" text DEFAULT 'employee' NOT NULL,
	"pin" text,
	"permissions_json" json DEFAULT '{}'::json,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_member_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"clock_on" timestamp with time zone,
	"clock_off" timestamp with time zone,
	"duration_minutes" integer,
	"manual_entry" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"booking_id" integer,
	"title" text NOT NULL,
	"description" text,
	"deck_type" text,
	"dimension_text" text,
	"materials_text" text,
	"before_photos" json DEFAULT '[]'::json,
	"after_photos" json DEFAULT '[]'::json,
	"testimonial" text,
	"customer_name" text,
	"rating" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'other' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_sources_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sign_up_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"referral_code" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_master_project_id_master_projects_id_fk" FOREIGN KEY ("master_project_id") REFERENCES "public"."master_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_projects" ADD CONSTRAINT "master_projects_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_clerk_user_id_idx" ON "customers" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "materials_clerk_user_id_idx" ON "materials" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "quotes_clerk_user_id_idx" ON "quotes" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "bookings_clerk_user_id_idx" ON "bookings" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "team_members_clerk_user_id_idx" ON "team_members" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "portfolio_entries_clerk_user_id_idx" ON "portfolio_entries" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "referral_sources_clerk_user_id_idx" ON "referral_sources" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "sign_up_leads_clerk_user_id_idx" ON "sign_up_leads" USING btree ("clerk_user_id");