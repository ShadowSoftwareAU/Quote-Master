import {
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { masterProjectsTable } from "./master-projects";

export const masterProjectAcceptancesTable = pgTable(
  "master_project_acceptances",
  {
    id: serial("id").primaryKey(),
    masterProjectId: integer("master_project_id")
      .notNull()
      .references(() => masterProjectsTable.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    proposalSnapshot: jsonb("proposal_snapshot").notNull(),
  },
);

export const insertMasterProjectAcceptanceSchema = createInsertSchema(
  masterProjectAcceptancesTable,
).omit({
  id: true,
  acceptedAt: true,
});

export type InsertMasterProjectAcceptance = z.infer<
  typeof insertMasterProjectAcceptanceSchema
>;
export type MasterProjectAcceptanceRow =
  typeof masterProjectAcceptancesTable.$inferSelect;