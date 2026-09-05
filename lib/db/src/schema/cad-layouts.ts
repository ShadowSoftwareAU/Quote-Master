import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { quotesTable } from "./quotes";

export type CadTradeCategory = "carpentry" | "electrical" | "plumbing";

export interface CadVector3 {
  x: number;
  y: number;
  z: number;
}

export interface CadStructuralComponent {
  id: string;
  name: string;
  type:
    | "beam"
    | "post"
    | "joist"
    | "wall"
    | "decking-board"
    | "handrail"
    | "conduit"
    | "cable"
    | "outlet"
    | "junction-box"
    | "pipe"
    | "fitting"
    | "fixture";
  tradeCategory: CadTradeCategory;
  material: string;
  materialSku: string | null;
  geometryId: string;
  dimensions: CadVector3;
  position: CadVector3;
  rotation: CadVector3;
}

export interface CadLayoutPayload {
  version: 1;
  units: "metres";
  coordinateSystem: "right-handed-y-up";
  rotationUnit: "radians";
  tradeCategory: CadTradeCategory;
  dimensions: CadVector3;
  origin: CadVector3;
  structuralComponents: CadStructuralComponent[];
}

export const cadGeneratedLayoutsTable = pgTable(
  "cad_generated_layouts",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id")
      .notNull()
      .references(() => quotesTable.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    tradeCategory: text("trade_category").$type<CadTradeCategory>().notNull(),
    layoutJson: jsonb("layout_json").$type<CadLayoutPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "cad_generated_layouts_trade_category_check",
      sql`${table.tradeCategory} in ('carpentry', 'electrical', 'plumbing')`,
    ),
    check(
      "cad_generated_layouts_prompt_not_blank_check",
      sql`char_length(btrim(${table.prompt})) > 0`,
    ),
    index("cad_generated_layouts_quote_id_idx").on(table.quoteId),
  ],
);

export type CadGeneratedLayoutRow =
  typeof cadGeneratedLayoutsTable.$inferSelect;
