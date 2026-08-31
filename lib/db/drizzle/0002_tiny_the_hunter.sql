CREATE TABLE "profile_metadata_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"profile_version" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "profile_metadata_outbox_user_version_uidx" ON "profile_metadata_outbox" USING btree ("clerk_user_id","profile_version");--> statement-breakpoint
CREATE INDEX "profile_metadata_outbox_due_idx" ON "profile_metadata_outbox" USING btree ("status","available_at");