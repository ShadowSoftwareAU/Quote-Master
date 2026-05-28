import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  quotesTable,
  quoteLineItemsTable,
  materialsTable,
  customersTable,
} from "@workspace/db";
import {
  CreateQuoteBody,
  UpdateQuoteBody,
  UpdateQuoteParams,
  DeleteQuoteParams,
  GetQuoteParams,
  SetQuoteStatusBody,
  SetQuoteStatusParams,
  EstimateDeckBody,
  CreateQuoteVariationBody,
  CreateQuoteVariationParams,
} from "@workspace/api-zod";
import { estimateDeck, calcTotals, type DeckSpec } from "../lib/estimator";

const router: IRouter = Router();

function specFromQuoteInput(input: {
  lengthM: number;
  widthM: number;
  heightM?: number;
  boardWidthMm?: number;
  gapSpacingMm?: number;
  joistSpacingMm?: number;
  bearerSpacingMm?: number;
  postSpacingMm?: number;
  wastageFactor?: number;
  deckBoardType?: string;
  subframeType?: string;
  fastenerType?: string;
  fasciaType?: string;
  includeHandrails?: boolean;
  handrailHeightMm?: number;
  balustradeType?: string;
  timberGapMm?: number;
  wireSpacingMm?: number;
  includeStairs?: boolean;
  stairFlights?: number;
  includeFencing?: boolean;
  fencingSides?: number;
  fencingHeightM?: number;
  fencingWidthM?: number;
  includeAwning?: boolean;
  awningWidthM?: number;
  awningLengthM?: number;
}): DeckSpec {
  return {
    lengthM: input.lengthM,
    widthM: input.widthM,
    heightM: input.heightM ?? 0.6,
    boardWidthMm: input.boardWidthMm ?? 90,
    gapSpacingMm: input.gapSpacingMm ?? 4,
    joistSpacingMm: input.joistSpacingMm ?? 450,
    bearerSpacingMm: input.bearerSpacingMm ?? 1800,
    postSpacingMm: input.postSpacingMm ?? 1800,
    wastageFactor: input.wastageFactor ?? 1.1,
    deckBoardType: input.deckBoardType ?? "treated_pine",
    subframeType: input.subframeType ?? "stumps",
    fastenerType: input.fastenerType ?? "screws",
    fasciaType: input.fasciaType ?? "none",
    includeHandrails: input.includeHandrails ?? false,
    handrailHeightMm: input.handrailHeightMm ?? 1000,
    balustradeType: input.balustradeType ?? "timber",
    timberGapMm: input.timberGapMm ?? 15,
    wireSpacingMm: input.wireSpacingMm ?? 100,
    includeStairs: input.includeStairs ?? false,
    stairFlights: input.stairFlights ?? 1,
    includeFencing: input.includeFencing ?? false,
    fencingSides: input.fencingSides ?? 1,
    fencingHeightM: input.fencingHeightM ?? 1.8,
    fencingWidthM: input.fencingWidthM ?? 1.8,
    includeAwning: input.includeAwning ?? false,
    awningWidthM: input.awningWidthM ?? 3,
    awningLengthM: input.awningLengthM ?? 3,
  };
}

function quoteSummaryRow(row: typeof quotesTable.$inferSelect & {
  customerName: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    customerId: row.customerId,
    customerName: row.customerName,
    lengthM: Number(row.lengthM),
    widthM: Number(row.widthM),
    total: Number(row.total),
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadQuoteJson(id: number) {
  const [row] = await db
    .select({
      q: quotesTable,
      customerName: customersTable.name,
    })
    .from(quotesTable)
    .leftJoin(customersTable, eq(customersTable.id, quotesTable.customerId))
    .where(eq(quotesTable.id, id));
  if (!row) return null;
  const lines = await db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, id))
    .orderBy(quoteLineItemsTable.id);
  return {
    id: row.q.id,
    title: row.q.title,
    status: row.q.status,
    customerId: row.q.customerId,
    customerName: row.customerName,
    siteAddress: row.q.siteAddress,
    notes: row.q.notes,
    lengthM: Number(row.q.lengthM),
    widthM: Number(row.q.widthM),
    heightM: Number(row.q.heightM),
    boardWidthMm: row.q.boardWidthMm,
    joistSpacingMm: row.q.joistSpacingMm,
    bearerSpacingMm: row.q.bearerSpacingMm,
    postSpacingMm: row.q.postSpacingMm,
    wastageFactor: Number(row.q.wastageFactor),
    labourHours: Number(row.q.labourHours),
    labourRate: Number(row.q.labourRate),
    materialsSubtotal: Number(row.q.materialsSubtotal),
    labourCost: Number(row.q.labourCost),
    gst: Number(row.q.gst),
    total: Number(row.q.total),
    lineItems: lines.map((l) => ({
      id: l.id,
      quoteId: l.quoteId,
      materialId: l.materialId,
      description: l.description,
      category: l.category,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
    createdAt: row.q.createdAt.toISOString(),
    updatedAt: row.q.updatedAt.toISOString(),
  };
}

router.get("/quotes", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: quotesTable.id,
      title: quotesTable.title,
      status: quotesTable.status,
      customerId: quotesTable.customerId,
      customerName: customersTable.name,
      lengthM: quotesTable.lengthM,
      widthM: quotesTable.widthM,
      total: quotesTable.total,
      createdAt: quotesTable.createdAt,
    })
    .from(quotesTable)
    .leftJoin(customersTable, eq(customersTable.id, quotesTable.customerId))
    .orderBy(desc(quotesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      customerId: r.customerId,
      customerName: r.customerName,
      lengthM: Number(r.lengthM),
      widthM: Number(r.widthM),
      total: Number(r.total),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/quotes/estimate", async (req, res): Promise<void> => {
  const parsed = EstimateDeckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const spec = specFromQuoteInput(parsed.data);
  const materials = await db.select().from(materialsTable);
  const { lines, deckAreaM2, materialsSubtotal } = estimateDeck(
    spec,
    materials,
  );
  const labourHours = parsed.data.labourHours ?? 0;
  const labourRate = parsed.data.labourRate ?? 85;
  const { labourCost, gst, total } = calcTotals({
    materialsSubtotal,
    labourHours,
    labourRate,
  });
  res.json({
    spec: { ...spec, labourHours, labourRate },
    deckAreaM2,
    lines,
    materialsSubtotal,
    labourCost,
    gst,
    total,
  });
});

router.post("/quotes", async (req, res): Promise<void> => {
  const parsed = CreateQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const spec = specFromQuoteInput(data);
  const materials = await db.select().from(materialsTable);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = data.labourHours ?? 0;
  const labourRate = data.labourRate ?? 85;
  const { labourCost, gst, total } = calcTotals({
    materialsSubtotal,
    labourHours,
    labourRate,
  });

  const [created] = await db
    .insert(quotesTable)
    .values({
      title: data.title,
      customerId: data.customerId,
      siteAddress: data.siteAddress ?? null,
      notes: data.notes ?? null,
      lengthM: String(data.lengthM),
      widthM: String(data.widthM),
      heightM: String(spec.heightM),
      boardWidthMm: spec.boardWidthMm,
      joistSpacingMm: spec.joistSpacingMm,
      bearerSpacingMm: spec.bearerSpacingMm,
      postSpacingMm: spec.postSpacingMm,
      wastageFactor: String(spec.wastageFactor),
      labourHours: String(labourHours),
      labourRate: String(labourRate),
      materialsSubtotal: String(materialsSubtotal),
      labourCost: String(labourCost),
      gst: String(gst),
      total: String(total),
    })
    .returning();

  if (lines.length > 0) {
    await db.insert(quoteLineItemsTable).values(
      lines.map((l) => ({
        quoteId: created.id,
        materialId: l.materialId,
        description: l.description,
        category: l.category,
        quantity: String(l.quantity),
        unit: l.unit,
        unitPrice: String(l.unitPrice),
        lineTotal: String(l.lineTotal),
      })),
    );
  }

  const json = await loadQuoteJson(created.id);
  res.status(201).json(json);
});

router.get("/quotes/:id", async (req, res): Promise<void> => {
  const params = GetQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const json = await loadQuoteJson(params.data.id);
  if (!json) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  res.json(json);
});

router.patch("/quotes/:id", async (req, res): Promise<void> => {
  const params = UpdateQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateQuoteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const d = body.data;
  const spec = specFromQuoteInput({
    lengthM: d.lengthM ?? Number(existing.lengthM),
    widthM: d.widthM ?? Number(existing.widthM),
    heightM: d.heightM ?? Number(existing.heightM),
    boardWidthMm: d.boardWidthMm ?? existing.boardWidthMm,
    joistSpacingMm: d.joistSpacingMm ?? existing.joistSpacingMm,
    bearerSpacingMm: d.bearerSpacingMm ?? existing.bearerSpacingMm,
    postSpacingMm: d.postSpacingMm ?? existing.postSpacingMm,
    wastageFactor: d.wastageFactor ?? Number(existing.wastageFactor),
  });
  const materials = await db.select().from(materialsTable);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = d.labourHours ?? Number(existing.labourHours);
  const labourRate = d.labourRate ?? Number(existing.labourRate);
  const { labourCost, gst, total } = calcTotals({
    materialsSubtotal,
    labourHours,
    labourRate,
  });

  await db
    .update(quotesTable)
    .set({
      title: d.title ?? existing.title,
      customerId: d.customerId ?? existing.customerId,
      siteAddress: d.siteAddress ?? existing.siteAddress,
      notes: d.notes ?? existing.notes,
      lengthM: String(spec.lengthM),
      widthM: String(spec.widthM),
      heightM: String(spec.heightM),
      boardWidthMm: spec.boardWidthMm,
      joistSpacingMm: spec.joistSpacingMm,
      bearerSpacingMm: spec.bearerSpacingMm,
      postSpacingMm: spec.postSpacingMm,
      wastageFactor: String(spec.wastageFactor),
      labourHours: String(labourHours),
      labourRate: String(labourRate),
      materialsSubtotal: String(materialsSubtotal),
      labourCost: String(labourCost),
      gst: String(gst),
      total: String(total),
    })
    .where(eq(quotesTable.id, params.data.id));

  await db
    .delete(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, params.data.id));
  if (lines.length > 0) {
    await db.insert(quoteLineItemsTable).values(
      lines.map((l) => ({
        quoteId: params.data.id,
        materialId: l.materialId,
        description: l.description,
        category: l.category,
        quantity: String(l.quantity),
        unit: l.unit,
        unitPrice: String(l.unitPrice),
        lineTotal: String(l.lineTotal),
      })),
    );
  }

  const json = await loadQuoteJson(params.data.id);
  res.json(json);
});

router.patch("/quotes/:id/status", async (req, res): Promise<void> => {
  const params = SetQuoteStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SetQuoteStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .update(quotesTable)
    .set({ status: body.data.status })
    .where(eq(quotesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const json = await loadQuoteJson(params.data.id);
  res.json(json);
  void quoteSummaryRow; // silence unused
});

router.post("/quotes/:id/variation", async (req, res): Promise<void> => {
  const params = CreateQuoteVariationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateQuoteVariationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const original = await loadQuoteJson(params.data.id);
  if (!original) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const b = body.data;
  const spec = specFromQuoteInput({
    lengthM: b.lengthM ?? original.lengthM,
    widthM: b.widthM ?? original.widthM,
    heightM: b.heightM ?? original.heightM,
    boardWidthMm: original.boardWidthMm,
    joistSpacingMm: original.joistSpacingMm,
    bearerSpacingMm: original.bearerSpacingMm,
    postSpacingMm: original.postSpacingMm,
    wastageFactor: original.wastageFactor,
  });
  const materials = await db.select().from(materialsTable);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = b.labourHours ?? original.labourHours;
  const labourRate = b.labourRate ?? original.labourRate;
  const { labourCost, gst, total } = calcTotals({ materialsSubtotal, labourHours, labourRate });

  const [created] = await db
    .insert(quotesTable)
    .values({
      title: b.title,
      customerId: original.customerId,
      siteAddress: original.siteAddress ?? null,
      notes: b.notes ?? `Variation of: ${original.title}`,
      lengthM: String(spec.lengthM),
      widthM: String(spec.widthM),
      heightM: String(spec.heightM),
      boardWidthMm: spec.boardWidthMm,
      joistSpacingMm: spec.joistSpacingMm,
      bearerSpacingMm: spec.bearerSpacingMm,
      postSpacingMm: spec.postSpacingMm,
      wastageFactor: String(spec.wastageFactor),
      labourHours: String(labourHours),
      labourRate: String(labourRate),
      materialsSubtotal: String(materialsSubtotal),
      labourCost: String(labourCost),
      gst: String(gst),
      total: String(total),
    })
    .returning();

  if (lines.length > 0) {
    await db.insert(quoteLineItemsTable).values(
      lines.map((l) => ({
        quoteId: created.id,
        materialId: l.materialId,
        description: l.description,
        category: l.category,
        quantity: String(l.quantity),
        unit: l.unit,
        unitPrice: String(l.unitPrice),
        lineTotal: String(l.lineTotal),
      })),
    );
  }

  const json = await loadQuoteJson(created.id);
  res.status(201).json(json);
});

router.delete("/quotes/:id", async (req, res): Promise<void> => {
  const params = DeleteQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, params.data.id));
  const [row] = await db
    .delete(quotesTable)
    .where(eq(quotesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
