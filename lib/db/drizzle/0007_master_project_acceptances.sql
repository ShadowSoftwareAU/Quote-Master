CREATE TABLE "master_project_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"master_project_id" integer NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"proposal_snapshot" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "master_project_acceptances" ADD CONSTRAINT "master_project_acceptances_master_project_id_master_projects_id_fk" FOREIGN KEY ("master_project_id") REFERENCES "public"."master_projects"("id") ON DELETE no action ON UPDATE no action;