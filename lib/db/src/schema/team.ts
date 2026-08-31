import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";

export const teamMembersTable = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    linkedClerkUserId: text("linked_clerk_user_id"),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: text("role").notNull().default("employee"), // owner | employee | subcontractor
    pin: text("pin"),
    permissionsJson: json("permissions_json").$type<Record<string, boolean>>().default({}),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("team_members_clerk_user_id_idx").on(table.clerkUserId),
    index("team_members_linked_clerk_user_id_idx").on(table.linkedClerkUserId),
  ],
);

export const timeEntriesTable = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  teamMemberId: integer("team_member_id").notNull(),
  jobId: integer("job_id").notNull(),
  clockOn: timestamp("clock_on", { withTimezone: true }),
  clockOff: timestamp("clock_off", { withTimezone: true }),
  durationMinutes: integer("duration_minutes"),
  manualEntry: boolean("manual_entry").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobAssignmentsTable = pgTable("job_assignments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  teamMemberId: integer("team_member_id").notNull(),
  roleOnJob: text("role_on_job"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TeamMemberRow = typeof teamMembersTable.$inferSelect;
export type TimeEntryRow = typeof timeEntriesTable.$inferSelect;
export type JobAssignmentRow = typeof jobAssignmentsTable.$inferSelect;
