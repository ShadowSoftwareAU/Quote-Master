ALTER TABLE "materials"
  ADD COLUMN "vendor_name" text,
  ADD COLUMN "vendor_sku" text,
  ADD COLUMN "last_updated" timestamp with time zone NOT NULL DEFAULT now();--> statement-breakpoint
UPDATE "materials"
SET "vendor_name" = "supplier"
WHERE "vendor_name" IS NULL;