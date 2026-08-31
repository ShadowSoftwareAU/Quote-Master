import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { customersTable, db, masterProjectsTable, quotesTable } from "@workspace/db";
import {
  CreateMasterProjectBody, DeleteMasterProjectParams, GetMasterProjectParams,
  GetMasterProjectPortalParams, RegenerateMasterProjectPortalTokenParams,
  RevokeMasterProjectPortalTokenParams, SetMasterProjectPortalStatusBody,
  SetMasterProjectPortalStatusParams,
  SetMasterProjectQuotesBody, SetMasterProjectQuotesParams, UpdateMasterProjectBody,
  UpdateMasterProjectParams,
} from "@workspace/api-zod";
import { requireMasterBuilder } from "../middlewares/masterBuilderAuth";
import { getBusinessRole } from "../middlewares/businessRoleAuth";
import {
  acceptMasterProjectByPortalToken,
  getMasterProject,
  getMasterProjectByPortalToken,
  listMasterProjects,
  recalculateMasterProjectTotals,
} from "../services/masterProjects";

const router: IRouter = Router();

function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

function publicMasterProject(project: NonNullable<Awaited<ReturnType<typeof getMasterProjectByPortalToken>>>) {
  const {
    customerId: _customerId,
    customerName: _customerName,
    hasActivePortalLink: _hasActivePortalLink,
    acceptanceHistory: _acceptanceHistory,
    ...publicProject
  } = project;
  return {
    ...publicProject,
    quotes: project.quotes.map(({ customerId: _quoteCustomerId, ...quote }) => quote),
    tradeGroups: project.tradeGroups.map((group) => ({
      ...group,
      quotes: group.quotes.map(({ customerId: _quoteCustomerId, ...quote }) => quote),
    })),
  };
}

function isStrictAcceptance(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === 1 && keys[0] === "status";
}

router.get("/master-project/:token", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const params = DeleteMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const project = await db.transaction(async (tx) => {
    const [updated] = await tx.update(masterProjectsTable).set({
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
      ...(body.data.builderMarginPct !== undefined ? { builderMarginPct: String(body.data.builderMarginPct) } : {}),
    }).where(and(
      eq(masterProjectsTable.id, params.data.id),
      inArray(
        masterProjectsTable.customerId,
        tx.select({ id: customersTable.id }).from(customersTable)
          .where(eq(customersTable.clerkUserId, clerkUserId)),
      ),
    )).returning();
    if (!updated) return null;
    await recalculateMasterProjectTotals(updated.id, clerkUserId, tx);
    return updated;
  });
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(publicMasterProject(project));
});

router.patch("/master-project/:token/status", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const params = DeleteMasterProjectParams.safeParse(req.params);
  const body = SetMasterProjectQuotesBody.safeParse(req.body);
  const project = await db.transaction(async (tx) => {
    const [updated] = await tx.update(masterProjectsTable).set({
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
      ...(body.data.builderMarginPct !== undefined ? { builderMarginPct: String(body.data.builderMarginPct) } : {}),
    }).where(and(
      eq(masterProjectsTable.id, params.data.id),
      inArray(
        masterProjectsTable.customerId,
        tx.select({ id: customersTable.id }).from(customersTable)
          .where(eq(customersTable.clerkUserId, clerkUserId)),
      ),
    )).returning();
    if (!updated) return null;
    await recalculateMasterProjectTotals(updated.id, clerkUserId, tx);
    return updated;
  });
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(publicMasterProject(project));
});

router.use("/master-projects", async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (req.method === "GET" && userId && (await getBusinessRole(userId)) === "Subcontractor") {
    next();
    return;
  }
  await requireMasterBuilder(req, res, next);
});

router.get("/master-projects", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json(await listMasterProjects(clerkUserId));
});
router.post("/master-projects", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const body = SetMasterProjectQuotesBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const project = await db.transaction(async (tx) => {
    const [updated] = await tx.update(masterProjectsTable).set({
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
      ...(body.data.builderMarginPct !== undefined ? { builderMarginPct: String(body.data.builderMarginPct) } : {}),
    }).where(and(
      eq(masterProjectsTable.id, params.data.id),
      inArray(
        masterProjectsTable.customerId,
        tx.select({ id: customersTable.id }).from(customersTable)
          .where(eq(customersTable.clerkUserId, clerkUserId)),
      ),
    )).returning();
    if (!updated) return null;
    await recalculateMasterProjectTotals(updated.id, clerkUserId, tx);
    return updated;
  });
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  const json = await getMasterProject(result.projectId, clerkUserId);
  if (!json) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(json);
});
router.post("/master-projects/:id/portal-token", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const project = await db.transaction(async (tx) => {
    const [updated] = await tx.update(masterProjectsTable).set({
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
      ...(body.data.builderMarginPct !== undefined ? { builderMarginPct: String(body.data.builderMarginPct) } : {}),
    }).where(and(
      eq(masterProjectsTable.id, params.data.id),
      inArray(
        masterProjectsTable.customerId,
        tx.select({ id: customersTable.id }).from(customersTable)
          .where(eq(customersTable.clerkUserId, clerkUserId)),
      ),
    )).returning();
    if (!updated) return null;
    await recalculateMasterProjectTotals(updated.id, clerkUserId, tx);
    return updated;
  });
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(project);
});
router.patch("/master-projects/:id", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteMasterProjectParams.safeParse(req.params);
  const body = SetMasterProjectQuotesBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const project = await db.transaction(async (tx) => {
    const [updated] = await tx.update(masterProjectsTable).set({
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(body.data.status !== undefined ? { status: body.data.status } : {}),
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
      ...(body.data.builderMarginPct !== undefined ? { builderMarginPct: String(body.data.builderMarginPct) } : {}),
    }).where(and(
      eq(masterProjectsTable.id, params.data.id),
      inArray(
        masterProjectsTable.customerId,
        tx.select({ id: customersTable.id }).from(customersTable)
          .where(eq(customersTable.clerkUserId, clerkUserId)),
      ),
    )).returning();
    if (!updated) return null;
    await recalculateMasterProjectTotals(updated.id, clerkUserId, tx);
    return updated;
  });
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  const json = await getMasterProject(result.projectId, clerkUserId);
  if (!json) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(json);
});
router.post("/master-projects/:id/portal-token", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteMasterProjectParams.safeParse(req.params);
  const body = SetMasterProjectQuotesBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const result = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ project: masterProjectsTable })
      .from(masterProjectsTable)
      .innerJoin(customersTable, and(
        eq(customersTable.id, masterProjectsTable.customerId),
        eq(customersTable.clerkUserId, clerkUserId),
      ))
      .where(eq(masterProjectsTable.id, params.data.id));
    if (!project) return { ok: false, error: "Master Project not found", status: 404 } as const;
    const selected = body.data.quoteIds.length ? await tx.select().from(quotesTable).where(and(
      inArray(quotesTable.id, body.data.quoteIds),
      eq(quotesTable.clerkUserId, clerkUserId),
    )) : [];
    if (selected.length !== body.data.quoteIds.length) return { ok: false, error: "One or more quotes do not exist", status: 400 } as const;
    if (selected.some((quote) => quote.customerId !== project.project.customerId)) return { ok: false, error: "All child quotes must belong to the project customer", status: 400 } as const;
    if (selected.some((quote) => quote.masterProjectId !== null && quote.masterProjectId !== project.project.id)) return { ok: false, error: "A selected quote already belongs to another Master Project", status: 409 } as const;
    await tx.update(quotesTable).set({ masterProjectId: null }).where(and(
      eq(quotesTable.masterProjectId, project.project.id),
      eq(quotesTable.clerkUserId, clerkUserId),
    ));
    if (body.data.quoteIds.length) await tx.update(quotesTable).set({ masterProjectId: project.project.id }).where(and(
      inArray(quotesTable.id, body.data.quoteIds),
      eq(quotesTable.clerkUserId, clerkUserId),
    ));
    await recalculateMasterProjectTotals(project.project.id, clerkUserId, tx);
    return { ok: true, projectId: project.project.id } as const;
  });
  if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
  const json = await getMasterProject(result.projectId, clerkUserId);
  if (!json) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json(json);
});
router.post("/master-projects/:id/portal-token", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.delete(masterProjectsTable).where(and(
    eq(masterProjectsTable.id, params.data.id),
    inArray(
      masterProjectsTable.customerId,
      db.select({ id: customersTable.id }).from(customersTable)
        .where(eq(customersTable.clerkUserId, clerkUserId)),
    ),
  )).returning();
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  req.log?.info({ userId: clerkUserId, masterProjectId: params.data.id }, "Master Project portal token revoked");
  res.json({ revoked: true });
});
router.delete("/master-projects/:id", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.delete(masterProjectsTable).where(and(
    eq(masterProjectsTable.id, params.data.id),
    inArray(
      masterProjectsTable.customerId,
      db.select({ id: customersTable.id }).from(customersTable)
        .where(eq(customersTable.clerkUserId, clerkUserId)),
    ),
  )).returning();
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  req.log?.info({ userId: clerkUserId, masterProjectId: params.data.id }, "Master Project portal token revoked");
  res.json({ revoked: true });
});
router.delete("/master-projects/:id", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteMasterProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.delete(masterProjectsTable).where(and(
    eq(masterProjectsTable.id, params.data.id),
    inArray(
      masterProjectsTable.customerId,
      db.select({ id: customersTable.id }).from(customersTable)
        .where(eq(customersTable.clerkUserId, clerkUserId)),
    ),
  )).returning();
  if (!project) { res.status(404).json({ error: "Master Project not found" }); return; }
  res.json({ success: true, id: project.id });
});
export default router;
