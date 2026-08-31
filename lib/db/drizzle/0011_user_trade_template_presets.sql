CREATE TABLE "trade_template_presets" (
  "id" serial PRIMARY KEY NOT NULL,
  "clerk_user_id" text NOT NULL,
  "trade_type" text NOT NULL,
  "preset_key" text NOT NULL,
  "description" text NOT NULL,
  "category" text DEFAULT 'custom' NOT NULL,
  "quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
  "unit" text DEFAULT 'each' NOT NULL,
  "unit_type" text DEFAULT 'item' NOT NULL,
  "unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
  "markup_percentage" numeric(7, 2) DEFAULT '0' NOT NULL,
  "wastage_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
  "is_bulk_item" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "trade_template_presets_owner_trade_key_uidx"
  ON "trade_template_presets" USING btree ("clerk_user_id", "trade_type", "preset_key");--> statement-breakpoint
CREATE INDEX "trade_template_presets_owner_trade_idx"
  ON "trade_template_presets" USING btree ("clerk_user_id", "trade_type");