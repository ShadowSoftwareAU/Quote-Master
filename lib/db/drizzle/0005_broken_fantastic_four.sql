-- Existing numeric portal links are intentionally disabled. Legacy quote owners
-- can issue a new secure link through the authenticated portal-token endpoint.
ALTER TABLE "quotes" ADD COLUMN "portal_token" text;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "is_master_builder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_portal_token_uidx" ON "quotes" USING btree ("portal_token");