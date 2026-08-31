ALTER TABLE "team_members" ADD COLUMN "linked_clerk_user_id" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "assigned_team_member_id" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_assigned_team_member_id_team_members_id_fk" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_members_linked_clerk_user_id_idx" ON "team_members" USING btree ("linked_clerk_user_id");--> statement-breakpoint
CREATE INDEX "quotes_assigned_team_member_id_idx" ON "quotes" USING btree ("assigned_team_member_id");