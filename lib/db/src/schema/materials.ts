import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const materialsTable = pgTable(
  "materials",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id"),
    name: text("name").notNull(),
    sku: text("sku"),
    vendorName: text("vendor_name"),
    vendorSku: text("vendor_sku"),
    category: text("category").notNull(),
    unit: text("unit").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    tradeCost: numeric("trade_cost", { precision: 12, scale: 2 }),
    packSize: integer("pack_size"),
    supplier: text("supplier").notNull(),
    notes: text("notes"),
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("materials_clerk_user_id_idx").on(table.clerkUserId)],
);

export type Material = typeof materialsTable.$inferSelect;
