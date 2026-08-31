import {
  index,
  jsonb,
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