import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, materialsTable } from "@workspace/db";
import {
  CreateMaterialBody,
  UpdateMaterialBody,
  UpdateMaterialParams,
  DeleteMaterialParams,
  ListMaterialsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function rowToJson(row: typeof materialsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    unitPrice: Number(row.unitPrice),
    packSize: row.packSize,
    supplier: row.supplier,
    notes: row.notes,
  };
}

router.get("/materials", async (req, res): Promise<void> => {
  const q = ListMaterialsQueryParams.safeParse(req.query);
  const rows = await db
    .select()
    .from(materialsTable)
    .orderBy(materialsTable.category, materialsTable.name);
  const filtered = q.success && q.data.category
    ? rows.filter((r) => r.category === q.data.category)
    : rows;
  res.json(filtered.map(rowToJson));
});

router.post("/materials", async (req, res): Promise<void> => {
  const parsed = CreateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { unitPrice, ...rest } = parsed.data;
  const [row] = await db
    .insert(materialsTable)
    .values({ ...rest, unitPrice: String(unitPrice) })
    .returning();
  res.status(201).json(rowToJson(row));
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const params = UpdateMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateMaterialBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { unitPrice, ...rest } = body.data;
  const update: Record<string, unknown> = { ...rest };
  if (unitPrice !== undefined) update.unitPrice = String(unitPrice);
  const [row] = await db
    .update(materialsTable)
    .set(update)
    .where(eq(materialsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.json(rowToJson(row));
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  const params = DeleteMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(materialsTable)
    .where(eq(materialsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
