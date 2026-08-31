-- Keep the oldest row for each worker/job pair before enforcing uniqueness.
LOCK TABLE "job_assignments" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
DELETE FROM "job_assignments" AS duplicate
USING "job_assignments" AS keeper
WHERE duplicate."job_id" = keeper."job_id"
  AND duplicate."team_member_id" = keeper."team_member_id"
  AND (duplicate."assigned_at", duplicate."id") > (keeper."assigned_at", keeper."id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_assignments_job_id_team_member_id_uidx"
  ON "job_assignments" USING btree ("job_id", "team_member_id");