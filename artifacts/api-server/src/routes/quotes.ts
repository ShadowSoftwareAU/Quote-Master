import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, desc, isNotNull, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  quotesTable,
  quoteLineItemsTable,
  materialsTable,
  customersTable,
  businessProfilesTable,
  teamMembersTable,
  bookingsTable,
  jobAssignmentsTable,
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
  GetQuotePortalParams,
  UpdateQuotePortalBody,
  UpdateQuotePortalParams,
  SetQuotePortalStatusBody,
  SetQuotePortalStatusParams,
} from "@workspace/api-zod";
import { estimateDeck, calcTotals, type DeckSpec } from "../lib/estimator";
import { recalculateMasterProjectTotals } from "../services/masterProjects";
import { complianceDisclaimerForTrade } from "../lib/quoteCompliance";
import { getLinkedTeamMember } from "../lib/assignmentAccess";
import { getBusinessRole, requireBusinessRole } from "../middlewares/businessRoleAuth";

const router: IRouter = Router();
const requireQuoteManager = requireBusinessRole("Owner", "Employee");

function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

function verifiedUserId(req: Parameters<typeof getAuth>[0]): string | null {
  try {
    return getAuth(req).userId ?? null;
  } catch {
    return null;
  }
}

async function customerBelongsToUser(customerId: number, userId: string): Promise<boolean> {
  const [customer] = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(and(eq(customersTable.id, customerId), eq(customersTable.clerkUserId, userId)));
  return Boolean(customer);
}

async function ownedMaterials(userId: string | null) {
  if (!userId) return [];
  return db.select().from(materialsTable).where(eq(materialsTable.clerkUserId, userId));
}

function specFromQuoteInput(input: {
  lengthM: number;
  widthM: number;
  heightM?: number;
  boardWidthMm?: number;
  gapSpacingMm?: number;
  joistSpacingMm?: number;
  bearerSpacingMm?: number;
  postSpacingMm?: number;
  footingDepthMm?: number;
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
    footingDepthMm: input.footingDepthMm ?? 450,
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

function specFromStoredQuote(row: typeof quotesTable.$inferSelect): DeckSpec {
  const savedSpec =
    row.specJson && typeof row.specJson === "object" && !Array.isArray(row.specJson)
      ? (row.specJson as Partial<DeckSpec>)
      : {};

  return specFromQuoteInput({
    lengthM: Number(row.lengthM),
    widthM: Number(row.widthM),
    heightM: Number(row.heightM),
    boardWidthMm: row.boardWidthMm,
    joistSpacingMm: row.joistSpacingMm,
    bearerSpacingMm: row.bearerSpacingMm,
    postSpacingMm: row.postSpacingMm,
    wastageFactor: Number(row.wastageFactor),
    ...savedSpec,
  });
}

function serialiseSpec(spec: DeckSpec): Record<string, unknown> {
  return { ...spec };
}

function quoteSummaryRow(row: typeof quotesTable.$inferSelect & {
  customerName: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    customerId: row.customerId,
    assignedTeamMemberId: row.assignedTeamMemberId,
    masterProjectId: row.masterProjectId,
    portalToken: row.portalToken,
    tradeType: row.tradeType,
    customerName: row.customerName,
    lengthM: Number(row.lengthM),
    widthM: Number(row.widthM),
    total: Number(row.total),
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadQuoteJson(id: number, userId?: string) {
  const member = userId ? await getLinkedTeamMember(userId) : null;
  if (userId && !member && await getBusinessRole(userId) === "Subcontractor") return null;
  const ownerUserId = member?.ownerClerkUserId ?? userId;
  const customerJoin = ownerUserId
    ? and(
        eq(customersTable.id, quotesTable.customerId),
        eq(customersTable.clerkUserId, ownerUserId),
      )
    : eq(customersTable.id, quotesTable.customerId);
  const [row] = await db
    .select({
      q: quotesTable,
      customerName: customersTable.name,
    })
    .from(quotesTable)
    .leftJoin(customersTable, customerJoin)
    .leftJoin(bookingsTable, eq(bookingsTable.quoteId, quotesTable.id))
    .leftJoin(jobAssignmentsTable, eq(jobAssignmentsTable.jobId, bookingsTable.id))
    .where(
      userId
        ? member
          ? and(
              eq(quotesTable.id, id),
              eq(quotesTable.clerkUserId, member.ownerClerkUserId!),
              or(
                eq(quotesTable.assignedTeamMemberId, member.id),
                eq(jobAssignmentsTable.teamMemberId, member.id),
              ),
            )
          : and(eq(quotesTable.id, id), eq(quotesTable.clerkUserId, userId))
        : eq(quotesTable.id, id),
    );
  if (!row) return null;
  if (userId && row.customerName === null) return null;
  const [profile] = row.q.clerkUserId
    ? await db
        .select({
          licenseNumber: businessProfilesTable.licenseNumber,
          tradeType: businessProfilesTable.tradeType,
        })
        .from(businessProfilesTable)
        .where(eq(businessProfilesTable.clerkUserId, row.q.clerkUserId))
        .limit(1)
    : [];
  const spec = specFromStoredQuote(row.q);
  const storedLines = userId && !member
    ? await db
        .select({ line: quoteLineItemsTable })
        .from(quoteLineItemsTable)
        .innerJoin(quotesTable, and(
          eq(quotesTable.id, quoteLineItemsTable.quoteId),
          eq(quotesTable.clerkUserId, userId),
        ))
        .where(eq(quoteLineItemsTable.quoteId, id))
        .orderBy(quoteLineItemsTable.id)
        .then((lines) => lines.map(({ line }) => line))
    : await db
        .select()
        .from(quoteLineItemsTable)
        .where(eq(quoteLineItemsTable.quoteId, id))
        .orderBy(quoteLineItemsTable.id);
  const referencedMaterialIds = Array.from(
    new Set(
      storedLines
        .map((line) => line.materialId)
        .filter((materialId): materialId is number => materialId !== null),
    ),
  );
  const allowedMaterialIds = new Set<number>();
  if (userId && referencedMaterialIds.length > 0) {
    const owned = await db
      .select({ id: materialsTable.id })
      .from(materialsTable)
      .where(eq(materialsTable.clerkUserId, userId));
    for (const material of owned) allowedMaterialIds.add(material.id);
  }
  const lines = storedLines.map((line) => ({
    ...line,
    materialId:
      !userId || line.materialId === null || allowedMaterialIds.has(line.materialId)
        ? line.materialId
        : null,
  }));
  return {
    id: row.q.id,
    title: row.q.title,
    status: row.q.status,
    customerId: row.q.customerId,
    assignedTeamMemberId: row.q.assignedTeamMemberId,
    masterProjectId: row.q.masterProjectId,
    portalToken: userId && !member ? row.q.portalToken : null,
    tradeType: row.q.tradeType,
    complianceDisclaimer:
      row.q.complianceDisclaimer ??
      complianceDisclaimerForTrade(profile?.tradeType ?? row.q.tradeType),
    contractorLicenseNumber:
      row.q.contractorLicenseNumber ?? profile?.licenseNumber ?? null,
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
    spec: {
      ...spec,
      labourHours: Number(row.q.labourHours),
      labourRate: Number(row.q.labourRate),
    },
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

type LoadedQuote = NonNullable<Awaited<ReturnType<typeof loadQuoteJson>>>;

function publicLineItem(line: LoadedQuote["lineItems"][number]) {
  return {
    description: line.description,
    category: line.category,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  };
}

function publicQuoteResponse(quote: LoadedQuote) {
  const { labourHours: _labourHours, labourRate: _labourRate, ...publicSpec } = quote.spec;
  return {
    id: quote.id,
    title: quote.title,
    status: quote.status,
    customerName: quote.customerName,
    siteAddress: quote.siteAddress,
    notes: quote.notes,
    complianceDisclaimer: quote.complianceDisclaimer,
    contractorLicenseNumber: quote.contractorLicenseNumber,
    spec: publicSpec,
    lineItems: quote.lineItems.map(publicLineItem),
    materialsSubtotal: quote.materialsSubtotal,
    labourCost: quote.labourCost,
    gst: quote.gst,
    total: quote.total,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function isStrictPublicUpgrade(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return (
    keys.length > 0 &&
    keys.every((key) => key === "deckBoardType" || key === "balustradeType")
  );
}

function isStrictPublicAcceptance(body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === 1 && keys[0] === "status";
}

async function loadQuoteJsonByPortalToken(token: string) {
  const [quote] = await db
    .select({ id: quotesTable.id })
    .from(quotesTable)
    .where(eq(quotesTable.portalToken, token))
    .limit(1);
  return quote ? loadQuoteJson(quote.id) : null;
}

router.get("/quotes", async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const member = await getLinkedTeamMember(userId);
  if (!member && await getBusinessRole(userId) === "Subcontractor") {
    res.json([]);
    return;
  }
  const rows = await db
    .selectDistinct({
      id: quotesTable.id,
      title: quotesTable.title,
      status: quotesTable.status,
      customerId: quotesTable.customerId,
      assignedTeamMemberId: quotesTable.assignedTeamMemberId,
      masterProjectId: quotesTable.masterProjectId,
      tradeType: quotesTable.tradeType,
      customerName: customersTable.name,
      lengthM: quotesTable.lengthM,
      widthM: quotesTable.widthM,
      total: quotesTable.total,
      createdAt: quotesTable.createdAt,
    })
    .from(quotesTable)
    .leftJoin(customersTable, and(
      eq(customersTable.id, quotesTable.customerId),
      eq(customersTable.clerkUserId, quotesTable.clerkUserId),
    ))
    .leftJoin(bookingsTable, eq(bookingsTable.quoteId, quotesTable.id))
    .leftJoin(jobAssignmentsTable, eq(jobAssignmentsTable.jobId, bookingsTable.id))
    .where(
      member
        ? and(
            eq(quotesTable.clerkUserId, member.ownerClerkUserId!),
            or(
              eq(quotesTable.assignedTeamMemberId, member.id),
              eq(jobAssignmentsTable.teamMemberId, member.id),
            ),
          )
        : and(
            eq(quotesTable.clerkUserId, userId),
            eq(customersTable.clerkUserId, userId),
          ),
    )
    .orderBy(desc(quotesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      customerId: r.customerId,
      assignedTeamMemberId: r.assignedTeamMemberId,
        masterProjectId: r.masterProjectId,
        tradeType: r.tradeType,
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
  const materials = await ownedMaterials(verifiedUserId(req));
  const { lines, deckAreaM2, materialsSubtotal, complianceWarnings } = estimateDeck(
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
    lines: lines.map(({ materialId: _materialId, ...line }) => line),
    materialsSubtotal,
    labourCost,
    gst,
    total,
    complianceWarnings,
  });
});

router.post("/quotes", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const [profile] = await db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.clerkUserId, userId))
    .limit(1);
  if (!profile) {
    res.status(409).json({ error: "Complete onboarding before creating a quote" });
    return;
  }
  if (!(await customerBelongsToUser(data.customerId, userId))) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  const spec = specFromQuoteInput(data);
  const materials = await ownedMaterials(userId);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = data.labourHours ?? 0;
  const labourRate = data.labourRate ?? 85;
  const { labourCost, gst, total } = calcTotals({
    materialsSubtotal,
    labourHours,
    labourRate,
  });

  const created = await db.transaction(async (tx) => {
    const [customer] = await tx.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.id, data.customerId), eq(customersTable.clerkUserId, userId)));
    if (!customer) return null;
    const [row] = await tx
      .insert(quotesTable)
      .values({
        clerkUserId: userId,
        title: data.title,
        customerId: data.customerId,
        tradeType: data.tradeType ?? "decking",
        portalToken: generatePortalToken(),
        complianceDisclaimer: complianceDisclaimerForTrade(profile.tradeType),
        contractorLicenseNumber: profile.licenseNumber,
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
        specJson: serialiseSpec(spec),
      })
      .returning();
    if (lines.length > 0) {
      await tx.insert(quoteLineItemsTable).values(
        lines.map((l) => ({
          quoteId: row.id,
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
    return row;
  });
  if (!created) { res.status(400).json({ error: "Customer not found" }); return; }

  const json = await loadQuoteJson(created.id, userId);
  if (!json) { res.status(404).json({ error: "Quote not found" }); return; }
  res.status(201).json(json);
});

router.get("/quotes/:id", async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = GetQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const json = await loadQuoteJson(params.data.id, userId);
  if (!json) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  res.json(json);
});

router.get("/quote/:token", async (req, res): Promise<void> => {
  const params = GetQuotePortalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const quote = await loadQuoteJsonByPortalToken(params.data.token);
  if (!quote) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  res.json(publicQuoteResponse(quote));
});

router.patch("/quotes/:id", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const clerkUserId = userId;
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
    .where(
      userId
        ? and(eq(quotesTable.id, params.data.id), eq(quotesTable.clerkUserId, userId))
        : eq(quotesTable.id, params.data.id),
    );
  if (!existing) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const d = body.data;
  if (d.assignedTeamMemberId !== undefined) {
    if ((await getBusinessRole(userId)) !== "Owner") {
      res.status(403).json({ error: "Owner role is required to assign quotes" });
      return;
    }
    if (d.assignedTeamMemberId !== null) {
      const [member] = await db.select({ id: teamMembersTable.id }).from(teamMembersTable).where(and(
        eq(teamMembersTable.id, d.assignedTeamMemberId),
        eq(teamMembersTable.clerkUserId, userId),
        eq(teamMembersTable.role, "subcontractor"),
        isNotNull(teamMembersTable.linkedClerkUserId),
        eq(teamMembersTable.active, true),
      ));
      if (!member) { res.status(400).json({ error: "Assigned Subcontractor not found" }); return; }
    }
  }
  if (
    userId &&
    d.customerId !== undefined &&
    !(await customerBelongsToUser(d.customerId, userId))
  ) {
    res.status(400).json({ error: "Customer not found" });
    return;
  }
  const savedSpec = specFromStoredQuote(existing);
  const spec = specFromQuoteInput({
    ...savedSpec,
    ...d,
    lengthM: d.lengthM ?? savedSpec.lengthM,
    widthM: d.widthM ?? savedSpec.widthM,
  });
  const materials = await ownedMaterials(userId ?? existing.clerkUserId);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = d.labourHours ?? Number(existing.labourHours);
  const labourRate = d.labourRate ?? Number(existing.labourRate);
  const { labourCost, gst, total } = calcTotals({
    materialsSubtotal,
    labourHours,
    labourRate,
  });

  const updated = await db.transaction(async (tx) => {
    if (userId && d.customerId !== undefined) {
      const [customer] = await tx
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(and(
          eq(customersTable.id, d.customerId),
          eq(customersTable.clerkUserId, userId),
        ));
      if (!customer) return null;
    }
    const [authorisedParent] = await tx
      .select({ id: quotesTable.id })
      .from(quotesTable)
      .where(
        userId
          ? and(eq(quotesTable.id, params.data.id), eq(quotesTable.clerkUserId, userId))
          : eq(quotesTable.id, params.data.id),
      );
    if (!authorisedParent) return null;
    const [row] = await tx
      .update(quotesTable)
      .set({
        title: d.title ?? existing.title,
        assignedTeamMemberId: d.assignedTeamMemberId === undefined ? existing.assignedTeamMemberId : d.assignedTeamMemberId,
        customerId: d.customerId ?? existing.customerId,
        tradeType: d.tradeType ?? existing.tradeType,
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
        specJson: serialiseSpec(spec),
      })
      .where(
        userId
          ? and(eq(quotesTable.id, params.data.id), eq(quotesTable.clerkUserId, userId))
          : eq(quotesTable.id, params.data.id),
      )
      .returning();
    if (!row) return null;
    await tx
      .delete(quoteLineItemsTable)
      .where(eq(quoteLineItemsTable.quoteId, authorisedParent.id));
    if (lines.length > 0) {
      await tx.insert(quoteLineItemsTable).values(
        lines.map((l) => ({
          quoteId: authorisedParent.id,
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
    const masterProjectOwnerId = clerkUserId ?? existing.clerkUserId;
    if (masterProjectOwnerId && existing.masterProjectId) {
      await recalculateMasterProjectTotals(existing.masterProjectId, masterProjectOwnerId, tx);
    }
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const json = await loadQuoteJson(params.data.id, userId ?? undefined);
  if (!json) { res.status(404).json({ error: "Quote not found" }); return; }
  res.json(json);
});

router.patch("/quotes/:id/status", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
    .where(
      userId
        ? and(eq(quotesTable.id, params.data.id), eq(quotesTable.clerkUserId, userId))
        : eq(quotesTable.id, params.data.id),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const json = await loadQuoteJson(params.data.id, userId ?? undefined);
  if (!json) { res.status(404).json({ error: "Quote not found" }); return; }
  res.json(json);
  void quoteSummaryRow; // silence unused
});

router.patch("/quote/:token", async (req, res): Promise<void> => {
  const params = UpdateQuotePortalParams.safeParse(req.params);
  const body = UpdateQuotePortalBody.safeParse(req.body);
  if (!params.success || !body.success || !isStrictPublicUpgrade(req.body)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [existing] = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.portalToken, params.data.token))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const d = body.data;
  const savedSpec = specFromStoredQuote(existing);
  const spec = specFromQuoteInput({
    ...savedSpec,
    ...d,
    lengthM: savedSpec.lengthM,
    widthM: savedSpec.widthM,
  });
  const materials = await ownedMaterials(existing.clerkUserId);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = Number(existing.labourHours);
  const labourRate = Number(existing.labourRate);
  const { labourCost, gst, total } = calcTotals({ materialsSubtotal, labourHours, labourRate });
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(quotesTable).set({
      specJson: serialiseSpec(spec),
      materialsSubtotal: String(materialsSubtotal),
      labourCost: String(labourCost),
      gst: String(gst),
      total: String(total),
    }).where(eq(quotesTable.portalToken, params.data.token)).returning();
    if (!row) return null;
    await tx.delete(quoteLineItemsTable).where(eq(quoteLineItemsTable.quoteId, row.id));
    if (lines.length > 0) {
      await tx.insert(quoteLineItemsTable).values(lines.map((l) => ({
        quoteId: row.id,
        materialId: l.materialId,
        description: l.description,
        category: l.category,
        quantity: String(l.quantity),
        unit: l.unit,
        unitPrice: String(l.unitPrice),
        lineTotal: String(l.lineTotal),
      })));
    }
    if (row.masterProjectId && row.clerkUserId) {
      await recalculateMasterProjectTotals(row.masterProjectId, row.clerkUserId, tx);
    }
    return row;
  });
  if (!updated) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const json = await loadQuoteJson(updated.id);
  if (!json) { res.status(404).json({ error: "Quote not found" }); return; }
  res.json(publicQuoteResponse(json));
});

router.patch("/quote/:token/status", async (req, res): Promise<void> => {
  const params = SetQuotePortalStatusParams.safeParse(req.params);
  const body = SetQuotePortalStatusBody.safeParse(req.body);
  if (
    !params.success ||
    !body.success ||
    body.data.status !== "accepted" ||
    !isStrictPublicAcceptance(req.body)
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [row] = await db.update(quotesTable)
    .set({ status: "accepted" })
    .where(eq(quotesTable.portalToken, params.data.token))
    .returning({ id: quotesTable.id });
  if (!row) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const json = await loadQuoteJson(row.id);
  if (!json) { res.status(404).json({ error: "Quote not found" }); return; }
  res.json(publicQuoteResponse(json));
});

router.post("/quotes/:id/variation", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
  const original = await loadQuoteJson(params.data.id, userId);
  if (!original) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }
  const b = body.data;
  const [profile] = await db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.clerkUserId, userId))
    .limit(1);
  if (!profile) {
    res.status(409).json({ error: "Complete onboarding before creating a quote" });
    return;
  }
  const spec = specFromQuoteInput({
    ...original.spec,
    lengthM: b.lengthM ?? original.spec.lengthM,
    widthM: b.widthM ?? original.spec.widthM,
  });
  const materials = await ownedMaterials(userId);
  const { lines, materialsSubtotal } = estimateDeck(spec, materials);
  const labourHours = b.labourHours ?? original.labourHours;
  const labourRate = b.labourRate ?? original.labourRate;
  const { labourCost, gst, total } = calcTotals({ materialsSubtotal, labourHours, labourRate });

  const created = await db.transaction(async (tx) => {
    const [authorisedOriginal] = await tx
      .select({ id: quotesTable.id })
      .from(quotesTable)
      .where(and(
        eq(quotesTable.id, params.data.id),
        eq(quotesTable.clerkUserId, userId),
      ));
    if (!authorisedOriginal) return null;
    const [row] = await tx.insert(quotesTable).values({
      clerkUserId: userId,
      title: b.title,
      customerId: original.customerId,
      tradeType: original.tradeType,
      portalToken: generatePortalToken(),
      complianceDisclaimer: complianceDisclaimerForTrade(profile.tradeType),
      contractorLicenseNumber: profile.licenseNumber,
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
      specJson: serialiseSpec(spec),
    }).returning();
    if (lines.length > 0) {
      await tx.insert(quoteLineItemsTable).values(
        lines.map((l) => ({
        quoteId: row.id,
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
    return row;
  });
  if (!created) { res.status(404).json({ error: "Quote not found" }); return; }

  const json = await loadQuoteJson(created.id, userId);
  if (!json) { res.status(404).json({ error: "Quote not found" }); return; }
  res.status(201).json(json);
});

router.delete("/quotes/:id", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = DeleteQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(quotesTable)
      .where(and(
        eq(quotesTable.id, params.data.id),
        eq(quotesTable.clerkUserId, userId),
      ));
    if (!existing) return null;
    await tx
      .delete(quoteLineItemsTable)
      .where(eq(quoteLineItemsTable.quoteId, existing.id));
    const [deleted] = await tx
      .delete(quotesTable)
      .where(and(
        eq(quotesTable.id, params.data.id),
        eq(quotesTable.clerkUserId, userId),
      ))
      .returning();
    if (deleted && existing.masterProjectId) {
      await recalculateMasterProjectTotals(existing.masterProjectId, userId, tx);
    }
    return deleted ? { deleted, masterProjectId: existing.masterProjectId } : null;
  });
  if (!row) { res.status(404).json({ error: "Quote not found" }); return; }
  res.json({ deleted: true, id: row.deleted.id });
});

router.post("/quotes/:id/portal-token", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetQuoteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.update(quotesTable)
    .set({ portalToken: generatePortalToken() })
    .where(and(eq(quotesTable.id, params.data.id), eq(quotesTable.clerkUserId, userId)))
    .returning({ portalToken: quotesTable.portalToken });
  if (!row) { res.status(404).json({ error: "Quote not found" }); return; }
  req.log?.info({ userId, quoteId: params.data.id }, "Quote portal token regenerated");
  res.json({ portalToken: row.portalToken });
});

router.delete("/quotes/:id/portal-token", requireQuoteManager, async (req, res): Promise<void> => {
  const userId = verifiedUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetQuoteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.update(quotesTable)
    .set({ portalToken: null })
    .where(and(eq(quotesTable.id, params.data.id), eq(quotesTable.clerkUserId, userId)))
    .returning({ id: quotesTable.id });
  if (!row) { res.status(404).json({ error: "Quote not found" }); return; }
  req.log?.info({ userId, quoteId: params.data.id }, "Quote portal token revoked");
  res.json({ revoked: true });
});

export default router;
