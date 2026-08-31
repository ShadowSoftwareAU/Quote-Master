ALTER TABLE "quote_line_items"
  ADD COLUMN "unit_type" text NOT NULL DEFAULT 'item',
  ADD COLUMN "wastage_percentage" numeric(5, 2) NOT NULL DEFAULT '0',
  ADD COLUMN "is_bulk_item" boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE TABLE "trade_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "trade_type" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "default_line_items" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "trade_templates_trade_type_slug_uidx"
  ON "trade_templates" USING btree ("trade_type", "slug");--> statement-breakpoint
CREATE INDEX "trade_templates_trade_type_idx"
  ON "trade_templates" USING btree ("trade_type");--> statement-breakpoint
INSERT INTO "trade_templates" ("trade_type", "name", "slug", "default_line_items")
VALUES
  (
    'Carpenter',
    'Decking',
    'decking',
    $$[
      {"description":"Structural treated pine timber","category":"structural-timber","quantity":48,"unit":"linear metre","unitType":"lm","unitCost":8.20,"markupPercentage":20,"wastagePercentage":10,"isBulkItem":false},
      {"description":"Merbau decking cladding","category":"cladding","quantity":32,"unit":"square metre","unitType":"sqm","unitCost":68.00,"markupPercentage":22,"wastagePercentage":8,"isBulkItem":false},
      {"description":"Bulk galvanised fixings and nails","category":"fixings","quantity":1.2,"unit":"box","unitType":"box","unitCost":145.00,"markupPercentage":25,"wastagePercentage":10,"isBulkItem":true}
    ]$$::jsonb
  ),
  (
    'Carpenter',
    'Internal Walls/Framing',
    'internal-walls-framing',
    $$[
      {"description":"Structural pine wall framing","category":"structural-timber","quantity":85,"unit":"linear metre","unitType":"lm","unitCost":7.40,"markupPercentage":20,"wastagePercentage":10,"isBulkItem":false},
      {"description":"Plasterboard wall cladding","category":"cladding","quantity":42,"unit":"square metre","unitType":"sqm","unitCost":18.50,"markupPercentage":22,"wastagePercentage":8,"isBulkItem":false},
      {"description":"Bulk framing screws and nails","category":"fixings","quantity":2.4,"unit":"box","unitType":"box","unitCost":98.00,"markupPercentage":25,"wastagePercentage":10,"isBulkItem":true}
    ]$$::jsonb
  ),
  (
    'Concreter',
    'Driveway/Slab Pour',
    'driveway-slab-pour',
    $$[
      {"description":"Ready-mix concrete","category":"concrete","quantity":8.5,"unit":"cubic metre","unitType":"m3","unitCost":245.00,"markupPercentage":18,"wastagePercentage":5,"isBulkItem":false},
      {"description":"SL72 reinforcing steel mesh","category":"reinforcement","quantity":18,"unit":"sheet","unitType":"item","unitCost":42.00,"markupPercentage":20,"wastagePercentage":8,"isBulkItem":true},
      {"description":"Timber formwork","category":"formwork","quantity":36,"unit":"linear metre","unitType":"lm","unitCost":12.50,"markupPercentage":20,"wastagePercentage":10,"isBulkItem":false}
    ]$$::jsonb
  )
ON CONFLICT ("trade_type", "slug") DO NOTHING;