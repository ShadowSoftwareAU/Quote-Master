import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, masterProjectsTable, quotesTable } from "@workspace/db";
import {
  CreateMasterProjectBody, DeleteMasterProjectParams, GetMasterProjectParams,
  SetMasterProjectQuotesBody, SetMasterProjectQuotesParams, UpdateMasterProjectBody,
  UpdateMasterProjectParams,
} from "@workspace/api-zod";
import { requireMasterBuilder } from "../middlewares/masterBuilderAuth";
import { getMasterProject, listMasterProjects, recalculateMasterProjectTotals } from "../services/masterProjects";

const router: IRouter = Router();
router.use(requireMasterBuilder);

router.get("/master-projects", async (_req, res): Promise<void> => { res.json(await listMasterProjects()); });
router.post("/master-projects", async (req, res): Promise<void> => {
  const body = CreateMasterProjectBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [project] = await db.insert(masterProjectsTable).values({
    title: body.data.title, customerId: body.data.customerId, notes: body.data.notes ?? null,
    builderMarginPct: String(body.data.builderMarginPct),
  }).returning();
  res.status(201).json(await getMasterProject(project.id));
});
router.get("/master-projects/:id", async (req, res): Promise<void> => {
  const params = GetMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const project = await getMasterProject(params.data.id);
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(project);
});
router.patch("/master-projects/:id", async (req, res): Promise<void> => {
  const params = UpdateMasterProjectParams.safeParse(req.params);
  const body = UpdateMasterProjectBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [project] = await db.update(masterProjectsTable).set({
    ...(body.data.title !== undefined ? { title: body.data.title } : {}),
    ...(body.data.status !== undefined ? { status: body.data.status } : {}),
    ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
    ...(body.data.builderMarginPct !== undefined ? { builderMarginPct: String(body.data.builderMarginPct) } : {}),
  }).where(eq(masterProjectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  await recalculateMasterProjectTotals(project.id);
  res.json(await getMasterProject(project.id));
});
router.put("/master-projects/:id/quotes", async (req, res): Promise<void> => {
  const params = SetMasterProjectQuotesParams.safeParse(req.params);
  const body = SetMasterProjectQuotesBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [project] = await db.select().from(masterProjectsTable).where(eq(masterProjectsTable.id, params.data.id));
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  const selected = body.data.quoteIds.length ? await db.select().from(quotesTable).where(inArray(quotesTable.id, body.data.quoteIds)) : [];
  if (selected.length !== body.data.quoteIds.length) { res.status(400).json({ error: "One or more quotes do not exist" }); return; }
  if (selected.some((quote) => quote.customerId !== project.customerId)) { res.status(400).json({ error: "All child quotes must belong to the project customer" }); return; }
  if (selected.some((quote) => quote.masterProjectId !== null && quote.masterProjectId !== project.id)) { res.status(409).json({ error: "A selected quote already belongs to another Master Project" }); return; }
  await db.transaction(async (tx) => {
    await tx.update(quotesTable).set({ masterProjectId: null }).where(eq(quotesTable.masterProjectId, project.id));
    if (body.data.quoteIds.length) await tx.update(quotesTable).set({ masterProjectId: project.id }).where(inArray(quotesTable.id, body.data.quoteIds));
  });
  await recalculateMasterProjectTotals(project.id);
  res.json(await getMasterProject(project.id));
});
router.delete("/master-projects/:id", async (req, res): Promise<void> => {
  const params = DeleteMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.delete(masterProjectsTable).where(eq(masterProjectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.sendStatus(204);
});
export default router;