CREATE TABLE "business_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"business_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"trade_type" text NOT NULL,
	"license_number" text,
	"role" text NOT NULL,
	"metadata_sync_status" text DEFAULT 'pending' NOT NULL,
	"metadata_sync_error" text,
	"metadata_sync_version" integer DEFAULT 1 NOT NULL,
	"metadata_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "business_profiles_clerk_user_id_uidx" ON "business_profiles" USING btree ("clerk_user_id");