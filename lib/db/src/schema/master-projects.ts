import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const masterProjectsTable = pgTable("master_projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id),
  portalToken: text("portal_token"),
  builderMarginPct: numeric("builder_margin_pct", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0"),
  materialsSubtotal: numeric("materials_subtotal", {
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default("0"),
  labourSubtotal: numeric("labour_subtotal", {
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default("0"),
  marginAmount: numeric("margin_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  gst: numeric("gst", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
  .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("master_projects_portal_token_uidx").on(table.portalToken),
]);

export const insertMasterProjectSchema = createInsertSchema(masterProjectsTable)
  .omit({
    id: true,
    materialsSubtotal: true,
    labourSubtotal: true,
    marginAmount: true,
    gst: true,
    total: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    builderMarginPct: z.number().min(0).max(99.99).optional(),
  });

export type InsertMasterProject = z.infer<typeof insertMasterProjectSchema>;
export type MasterProjectRow = typeof masterProjectsTable.$inferSelect;