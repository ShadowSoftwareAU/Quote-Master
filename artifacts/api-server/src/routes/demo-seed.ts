import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { getAuthenticatedClerkUserId } from "../middlewares/apiAuth";
import { requireOwner } from "../middlewares/businessRoleAuth";
import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  customersTable,
  db,
  masterProjectsTable,
  materialsTable,
  quoteLineItemsTable,
  quotesTable,
} from "@workspace/db";
import { SeedDemoDataBody } from "@workspace/api-zod";
import { recalculateMasterProjectTotals } from "../services/masterProjects";
import { calculateRequiredQuantity } from "../lib/estimator";

const router: IRouter = Router();
const DEMO_SEED_MARKER = "Deck Me presentation demo data — temporary development seed";

function developmentOnly(_req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
}

function money(value: number): string {
  return value.toFixed(2);
}

function portalToken(): string {
  return randomBytes(32).toString("base64url");
}

router.post(
  "/dev/seed-demo-data",
  developmentOnly,
  requireOwner,
  async (req, res): Promise<void> => {
    const parsed = SeedDemoDataBody.safeParse(req.body);
    if (
      !req.body
      || typeof req.body !== "object"
      || Array.isArray(req.body)
      || Object.keys(req.body).length > 0
      || !parsed.success
    ) {
      res.status(400).json({
        error: parsed.success
          ? "Request body must be an empty object"
          : parsed.error.message,
      });
      return;
    }

    const clerkUserId = getAuthenticatedClerkUserId(req);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(and(
          eq(customersTable.clerkUserId, clerkUserId),
          eq(customersTable.notes, DEMO_SEED_MARKER),
        ))
        .limit(1);

      if (existing) {
        return { kind: "existing" as const };
      }

      const customerFixtures = [
        {
          name: "Sophie Turner",
          company: "Turner Property Group",
          email: "sophie.turner@example.com",
          phone: "+61 412 555 018",
          address: "18 Banksia Avenue, Byron Bay NSW 2481",
          notes: DEMO_SEED_MARKER,
        },
        {
          name: "Jack McKenzie",
          company: "McKenzie Homes",
          email: "jack.mckenzie@example.com",
          phone: "+61 423 555 027",
          address: "42 Seabreeze Road, Newcastle NSW 2300",
          notes: "Prefers low-maintenance materials and weekday site visits.",
        },
        {
          name: "Priya Nair",
          company: "Nair & Co. Property",
          email: "priya.nair@example.com",
          phone: "+61 434 555 036",
          address: "7 Wattle Street, Geelong VIC 3220",
          notes: "Renovation timeline is flexible through spring.",
        },
        {
          name: "Lachlan and Mia Walsh",
          company: null,
          email: "walsh.family@example.com",
          phone: "+61 445 555 045",
          address: "9 Jacaranda Crescent, Brisbane QLD 4067",
          notes: "Family entertaining area with integrated stairs.",
        },
        {
          name: "Olivia Chen",
          company: "Harbourline Developments",
          email: "olivia.chen@example.com",
          phone: "+61 456 555 054",
          address: "25 Clipper Street, Fremantle WA 6160",
          notes: "Please coordinate access with the project manager.",
        },
      ] satisfies Array<typeof customersTable.$inferInsert>;

      const customers = await tx
        .insert(customersTable)
        .values(customerFixtures.map((customer) => ({ ...customer, clerkUserId })))
        .returning({ id: customersTable.id });

      const materialFixtures = [
        ["Merbau decking board 90mm", "decking", "metre", 18.95, 12.4, null, "Bunnings", "Rich colour, kiln dried"],
        ["Treated pine decking board 90mm", "decking", "metre", 9.8, 6.25, null, "Mitre 10", "H3 treated outdoor timber"],
        ["Treated pine joist 90 × 45mm", "joist", "metre", 7.4, 4.55, null, "Bunnings", "Structural H3 treated pine"],
        ["Treated pine bearer 140 × 45mm", "bearer", "metre", 12.9, 8.1, null, "Bunnings", "Structural H3 treated pine"],
        ["Galvanised stirrup post support", "post", "each", 22.5, 14.6, 1, "Mitre 10", "Hot-dip galvanised"],
        ["Concrete stump 300mm", "stump", "each", 14.75, 9.2, 1, "Local supplier", "Precast footing support"],
        ["Type 17 decking screws 10g", "screw", "pack", 34.9, 22.75, 250, "Bunnings", "Exterior-grade galvanised screws"],
        ["Galvanised joist hanger", "bracket", "each", 6.8, 4.15, 1, "Bunnings", "90mm joist compatible"],
        ["Cabot's decking oil 4L", "sealant", "each", 79.95, 55.0, 1, "Mitre 10", "Natural finish, water repellent"],
        ["Merbau fascia board 140mm", "other", "metre", 24.5, 16.9, null, "Local supplier", "Matching merbau trim"],
      ].map(([name, category, unit, unitPrice, tradeCost, packSize, supplier, notes], index) => ({
        name: name as string,
        sku: `DEMO-${String(index + 1).padStart(3, "0")}`,
        category: category as string,
        unit: unit as string,
        unitPrice: money(unitPrice as number),
        tradeCost: money(tradeCost as number),
        packSize: packSize as number | null,
        supplier: supplier as string,
        notes: notes as string,
        clerkUserId,
      }));

      const materials = await tx
        .insert(materialsTable)
        .values(materialFixtures)
        .returning({ id: materialsTable.id, unitPrice: materialsTable.unitPrice, name: materialsTable.name });

      const materialByName = new Map(materials.map((material) => [material.name, material]));
      const merbau = materialByName.get("Merbau decking board 90mm")!;
      const joist = materialByName.get("Treated pine joist 90 × 45mm")!;
      const bearer = materialByName.get("Treated pine bearer 140 × 45mm")!;
      const screws = materialByName.get("Type 17 decking screws 10g")!;
      const oil = materialByName.get("Cabot's decking oil 4L")!;
      const fascia = materialByName.get("Merbau fascia board 140mm")!;

      type DemoLineFixture = [
        number,
        string,
        string,
        number,
        string,
        number,
        string,
        number,
        boolean,
      ];

      const quoteFixtures = [
        {
          customerId: customers[0].id,
          title: "Byron Bay Entertainer Deck",
          status: "draft",
          siteAddress: "18 Banksia Avenue, Byron Bay NSW 2481",
          notes: "Initial concept for a north-facing entertaining deck.",
          lengthM: 5.2,
          widthM: 3.6,
          labourHours: 28,
          lines: [
            [merbau.id, merbau.name, "decking", 24, "metre", Number(merbau.unitPrice), "lm", 10, false],
            [joist.id, joist.name, "joist", 22, "metre", Number(joist.unitPrice), "lm", 10, false],
            [screws.id, screws.name, "screw", 1, "pack", Number(screws.unitPrice), "box", 0, true],
          ] satisfies DemoLineFixture[],
        },
        {
          customerId: customers[0].id,
          title: "Byron Bay Deck and Stairs",
          status: "sent",
          siteAddress: "18 Banksia Avenue, Byron Bay NSW 2481",
          notes: "Sent for customer review — includes two stair flights.",
          lengthM: 6.4,
          widthM: 4.1,
          labourHours: 42,
          lines: [
            [merbau.id, merbau.name, "decking", 34, "metre", Number(merbau.unitPrice), "lm", 10, false],
            [joist.id, joist.name, "joist", 29, "metre", Number(joist.unitPrice), "lm", 10, false],
            [bearer.id, bearer.name, "bearer", 16, "metre", Number(bearer.unitPrice), "lm", 10, false],
            [oil.id, oil.name, "sealant", 2, "each", Number(oil.unitPrice), "item", 5, false],
          ] satisfies DemoLineFixture[],
        },
        {
          customerId: customers[1].id,
          title: "Newcastle Coastal Composite Upgrade",
          status: "accepted",
          siteAddress: "42 Seabreeze Road, Newcastle NSW 2300",
          notes: "Accepted coastal entertaining area scope.",
          lengthM: 4.8,
          widthM: 3.2,
          labourHours: 31,
          lines: [
            [merbau.id, merbau.name, "decking", 22, "metre", Number(merbau.unitPrice), "lm", 10, false],
            [joist.id, joist.name, "joist", 20, "metre", Number(joist.unitPrice), "lm", 10, false],
            [screws.id, screws.name, "screw", 1, "pack", Number(screws.unitPrice), "box", 0, true],
            [oil.id, oil.name, "sealant", 1, "each", Number(oil.unitPrice), "item", 5, false],
          ] satisfies DemoLineFixture[],
        },
        {
          customerId: customers[2].id,
          title: "Geelong Raised Deck Proposal",
          status: "rejected",
          siteAddress: "7 Wattle Street, Geelong VIC 3220",
          notes: "Customer decided to defer the project.",
          lengthM: 7.1,
          widthM: 3.8,
          labourHours: 39,
          lines: [
            [merbau.id, merbau.name, "decking", 38, "metre", Number(merbau.unitPrice), "lm", 10, false],
            [joist.id, joist.name, "joist", 31, "metre", Number(joist.unitPrice), "lm", 10, false],
            [fascia.id, fascia.name, "other", 15, "metre", Number(fascia.unitPrice), "lm", 10, false],
          ] satisfies DemoLineFixture[],
        },
      ];

      const quoteRows = quoteFixtures.map((quote) => {
        const materialsSubtotal = quote.lines.reduce(
          (sum, [, , , quantity, , unitPrice, , wastagePercentage, isBulkItem]) =>
            sum + calculateRequiredQuantity(quantity, wastagePercentage, isBulkItem) * unitPrice,
          0,
        );
        const labourRate = 85;
        const labourCost = quote.labourHours * labourRate;
        const gst = (materialsSubtotal + labourCost) * 0.1;
        const total = materialsSubtotal + labourCost + gst;
        return {
          clerkUserId,
          title: quote.title,
          status: quote.status,
          customerId: quote.customerId,
          tradeType: "decking",
          portalToken: portalToken(),
          complianceDisclaimer: "This estimate is indicative only. Confirm site conditions and local requirements before construction.",
          contractorLicenseNumber: null,
          siteAddress: quote.siteAddress,
          notes: quote.notes,
          lengthM: money(quote.lengthM),
          widthM: money(quote.widthM),
          heightM: "0.6",
          boardWidthMm: 90,
          joistSpacingMm: 450,
          bearerSpacingMm: 1800,
          postSpacingMm: 1800,
          wastageFactor: "1.1",
          labourHours: money(quote.labourHours),
          labourRate: money(labourRate),
          materialsSubtotal: money(materialsSubtotal),
          labourCost: money(labourCost),
          gst: money(gst),
          total: money(total),
          specJson: {
            lengthM: quote.lengthM,
            widthM: quote.widthM,
            heightM: 0.6,
            boardWidthMm: 90,
            gapSpacingMm: 4,
            joistSpacingMm: 450,
            bearerSpacingMm: 1800,
            postSpacingMm: 1800,
            footingDepthMm: 450,
            wastageFactor: 1.1,
            deckBoardType: "treated_pine",
            subframeType: "stumps",
            fastenerType: "screws",
            fasciaType: "none",
            includeHandrails: false,
            handrailHeightMm: 1000,
            balustradeType: "timber",
            timberGapMm: 15,
            wireSpacingMm: 100,
            includeStairs: false,
            stairFlights: 1,
            includeFencing: false,
            fencingSides: 1,
            fencingHeightM: 1.8,
            fencingWidthM: 1.8,
            includeAwning: false,
            awningWidthM: 3,
            awningLengthM: 3,
          },
          lineFixtures: quote.lines,
        };
      });

      const quotes = await tx
        .insert(quotesTable)
        .values(quoteRows.map(({ lineFixtures: _lineFixtures, ...quote }) => quote))
        .returning({ id: quotesTable.id });

      const lineRows = quoteRows.flatMap((quote, quoteIndex) =>
        quote.lineFixtures.map((
          [materialId, description, category, quantity, unit, unitPrice, unitType, wastagePercentage, isBulkItem],
        ) => {
          const effectiveQuantity = calculateRequiredQuantity(quantity, wastagePercentage, isBulkItem);
          return {
            quoteId: quotes[quoteIndex].id,
            materialId,
            description,
            category,
            quantity: money(effectiveQuantity),
            unit,
            unitType,
            unitPrice: money(unitPrice),
            markupPercentage: "0.00",
            wastagePercentage: money(wastagePercentage),
            isBulkItem,
            lineTotal: money(effectiveQuantity * unitPrice),
          };
        }),
      );
      await tx.insert(quoteLineItemsTable).values(lineRows);

      const [project] = await tx
        .insert(masterProjectsTable)
        .values({
          title: "Turner Property Group — Outdoor Living Package",
          status: "draft",
          customerId: customers[0].id,
          portalToken: portalToken(),
          builderMarginPct: "12.00",
          notes: "Temporary presentation demo project combining the draft and sent Byron Bay quotes.",
        })
        .returning({ id: masterProjectsTable.id });

      await tx
        .update(quotesTable)
        .set({ masterProjectId: project.id })
        .where(and(
          eq(quotesTable.clerkUserId, clerkUserId),
          inArray(quotesTable.id, [quotes[0].id, quotes[1].id]),
        ));
      await recalculateMasterProjectTotals(project.id, clerkUserId, tx);

      return {
        kind: "created" as const,
        customerIds: customers.map(({ id }) => id),
        materialIds: materials.map(({ id }) => id),
        quoteIds: quotes.map(({ id }) => id),
        masterProjectId: project.id,
      };
    });

    if (result.kind === "existing") {
      res.status(409).json({
        error: "Demo data already exists for this workspace",
        code: "DEMO_SEED_EXISTS",
      });
      return;
    }

    res.status(201).json({
      seeded: true,
      counts: {
        customers: result.customerIds.length,
        materials: result.materialIds.length,
        quotes: result.quoteIds.length,
        masterProjects: 1,
      },
      customerIds: result.customerIds,
      materialIds: result.materialIds,
      quoteIds: result.quoteIds,
      masterProjectId: result.masterProjectId,
    });
  },
);

export default router;