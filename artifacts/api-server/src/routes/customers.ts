import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, customersTable } from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.clerkUserId, userId))
    .orderBy(customersTable.name);
  res.json(rows);
});

router.post("/customers", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(customersTable)
    .values({ ...parsed.data, clerkUserId: userId })
    .returning();
  res.status(201).json(row);
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.clerkUserId, userId)));
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(row);
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateCustomerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .update(customersTable)
    .set(body.data)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(row);
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(customersTable)
    .where(and(eq(customersTable.id, params.data.id), eq(customersTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json({ deleted: true });
});

export default router;
