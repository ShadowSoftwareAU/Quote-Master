ALTER TABLE "master_projects" ADD COLUMN "portal_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "master_projects_portal_token_uidx" ON "master_projects" USING btree ("portal_token");