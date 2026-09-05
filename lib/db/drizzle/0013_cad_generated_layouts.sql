CREATE TABLE "cad_generated_layouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"trade_category" text NOT NULL,
	"layout_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cad_generated_layouts_trade_category_check" CHECK ("trade_category" in ('carpentry', 'electrical', 'plumbing')),
	CONSTRAINT "cad_generated_layouts_prompt_not_blank_check" CHECK (char_length(btrim("prompt")) > 0)
);
--> statement-breakpoint
ALTER TABLE "cad_generated_layouts" ADD CONSTRAINT "cad_generated_layouts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "cad_generated_layouts_quote_id_idx" ON "cad_generated_layouts" USING btree ("quote_id");