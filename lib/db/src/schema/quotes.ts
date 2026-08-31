import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { masterProjectsTable } from "./master-projects";

export const quotesTable = pgTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    title: text("title").notNull(),
    status: text("status").notNull().default("draft"),
    customerId: integer("customer_id").notNull(),
    masterProjectId: integer("master_project_id").references(
      () => masterProjectsTable.id,
      { onDelete: "set null" },
    ),
    tradeType: text("trade_type").notNull().default("decking"),
    portalToken: text("portal_token"),
    complianceDisclaimer: text("compliance_disclaimer"),
    contractorLicenseNumber: text("contractor_license_number"),
    siteAddress: text("site_address"),
    notes: text("notes"),
    lengthM: numeric("length_m", { precision: 10, scale: 3 }).notNull(),
    widthM: numeric("width_m", { precision: 10, scale: 3 }).notNull(),
    heightM: numeric("height_m", { precision: 10, scale: 3 })
      .notNull()
      .default("0.6"),
    boardWidthMm: integer("board_width_mm").notNull().default(90),
    joistSpacingMm: integer("joist_spacing_mm").notNull().default(450),
    bearerSpacingMm: integer("bearer_spacing_mm").notNull().default(1800),
    postSpacingMm: integer("post_spacing_mm").notNull().default(1800),
    wastageFactor: numeric("wastage_factor", { precision: 5, scale: 3 })
      .notNull()
      .default("1.1"),
    labourHours: numeric("labour_hours", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    labourRate: numeric("labour_rate", { precision: 10, scale: 2 })
      .notNull()
      .default("85"),
    materialsSubtotal: numeric("materials_subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    labourCost: numeric("labour_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    gst: numeric("gst", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    specJson: jsonb("spec_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("quotes_clerk_user_id_idx").on(table.clerkUserId),
    uniqueIndex("quotes_portal_token_uidx").on(table.portalToken),
  ],
);

export const quoteLineItemsTable = pgTable("quote_line_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull(),
  materialId: integer("material_id"),
  description: text("description").notNull(),
  category: text("category").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});

export type QuoteRow = typeof quotesTable.$inferSelect;
export type QuoteLineItemRow = typeof quoteLineItemsTable.$inferSelect;
