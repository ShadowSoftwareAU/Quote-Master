import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type TradeTemplateLineItem = {
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitType: string;
  unitCost: number;
  markupPercentage: number;
  wastagePercentage: number;
  isBulkItem: boolean;
};

export const tradeTemplatesTable = pgTable(
  "trade_templates",
  {
    id: serial("id").primaryKey(),
    tradeType: text("trade_type").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    defaultLineItems: jsonb("default_line_items")
      .$type<TradeTemplateLineItem[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("trade_templates_trade_type_slug_uidx").on(
      table.tradeType,
      table.slug,
    ),
    index("trade_templates_trade_type_idx").on(table.tradeType),
  ],
);

export type TradeTemplateRow = typeof tradeTemplatesTable.$inferSelect;

export const tradeTemplatePresetsTable = pgTable(
  "trade_template_presets",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    tradeType: text("trade_type").notNull(),
    presetKey: text("preset_key").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("custom"),
    quantity: numeric("quantity", { precision: 12, scale: 3 })
      .notNull()
      .default("1"),
    unit: text("unit").notNull().default("each"),
    unitType: text("unit_type").notNull().default("item"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    markupPercentage: numeric("markup_percentage", { precision: 7, scale: 2 })
      .notNull()
      .default("0"),
    wastagePercentage: numeric("wastage_percentage", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    isBulkItem: boolean("is_bulk_item").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("trade_template_presets_owner_trade_key_uidx").on(
      table.clerkUserId,
      table.tradeType,
      table.presetKey,
    ),
    index("trade_template_presets_owner_trade_idx").on(
      table.clerkUserId,
      table.tradeType,
    ),
  ],
);

export type TradeTemplatePresetRow =
  typeof tradeTemplatePresetsTable.$inferSelect;