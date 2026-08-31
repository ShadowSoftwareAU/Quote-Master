UPDATE "quotes"
SET "compliance_disclaimer" = NULL
WHERE "compliance_disclaimer" = 'All specified works conform to the current Australian National Construction Code (NCC) and relevant Australian Standards (AS).';--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "compliance_disclaimer" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "compliance_disclaimer" DROP NOT NULL;