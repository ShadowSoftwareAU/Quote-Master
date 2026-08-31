import { and, desc, eq, inArray } from "drizzle-orm";
import {
  customersTable,
  db,
  masterProjectsTable,
  quoteLineItemsTable,
  quotesTable,
} from "@workspace/db";
import { STANDARD_NCC_DISCLAIMER } from "../lib/quoteCompliance";

const GST_RATE = 0.1;
type MasterProjectDbClient = Pick<typeof db, "select" | "update">;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildProjectPricing(
  materialsSubtotal: number,
  labourSubtotal: number,
  builderMarginPct: number,
) {
  const costBase = materialsSubtotal + labourSubtotal;
  const marginAmount =
    builderMarginPct === 0
      ? 0
      : roundMoney(costBase / (1 - builderMarginPct / 100) - costBase);
  const subtotalBeforeGst = roundMoney(costBase + marginAmount);
  const gst = roundMoney(subtotalBeforeGst * GST_RATE);
  return { materialsSubtotal, labourSubtotal, marginAmount, gst, total: roundMoney(subtotalBeforeGst + gst) };
}

function tradeLabel(tradeType: string): string {
  const value = tradeType.trim();
  if (!value || value.toLowerCase() === "other") return "Other trade";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadMasterProject(projectId: number, clerkUserId?: string) {
  const customerJoin = clerkUserId
    ? and(
        eq(customersTable.id, masterProjectsTable.customerId),
        eq(customersTable.clerkUserId, clerkUserId),
      )
    : eq(customersTable.id, masterProjectsTable.customerId);
  const [project] = await db
    .select({ project: masterProjectsTable, customerName: customersTable.name })
    .from(masterProjectsTable)
    .innerJoin(customersTable, customerJoin)
    .where(eq(masterProjectsTable.id, projectId));
  if (!project) return null;

  const quotesWhere = clerkUserId
    ? and(
        eq(quotesTable.masterProjectId, projectId),
        eq(quotesTable.clerkUserId, clerkUserId),
      )
    : eq(quotesTable.masterProjectId, projectId);
  const quotes = await db
    .select()
    .from(quotesTable)
    .where(quotesWhere)
    .orderBy(desc(quotesTable.createdAt));
  const quoteIds = quotes.map((quote) => quote.id);
  const lineItems =
    quoteIds.length === 0
      ? []
      : await db
          .select({ line: quoteLineItemsTable })
          .from(quoteLineItemsTable)
          .innerJoin(
            quotesTable,
            clerkUserId
              ? and(
                  eq(quotesTable.id, quoteLineItemsTable.quoteId),
                  eq(quotesTable.clerkUserId, clerkUserId),
                )
              : eq(quotesTable.id, quoteLineItemsTable.quoteId),
          )
          .where(inArray(quoteLineItemsTable.quoteId, quoteIds))
          .then((rows) => rows.map((row) => row.line));

  const linesByQuoteId = new Map<number, typeof lineItems>();
  for (const item of lineItems) {
    const current = linesByQuoteId.get(item.quoteId) ?? [];
    current.push(item);
    linesByQuoteId.set(item.quoteId, current);
  }

  const quotePayload = quotes.map((quote) => ({
    id: quote.id,
    title: quote.title,
    status: quote.status,
    customerId: quote.customerId,
    tradeType: quote.tradeType?.trim() || "other",
    materialsSubtotal: Number(quote.materialsSubtotal),
    labourCost: Number(quote.labourCost),
    gst: Number(quote.gst),
    total: Number(quote.total),
    lineItems: (linesByQuoteId.get(quote.id) ?? []).map((line) => ({
      id: line.id,
      quoteId: line.quoteId,
      description: line.description,
      category: line.category,
      quantity: Number(line.quantity),
      unit: line.unit,
      unitPrice: Number(line.unitPrice),
      lineTotal: Number(line.lineTotal),
    })),
    createdAt: quote.createdAt.toISOString(),
  }));

  const tradeGroups = Array.from(
    quotePayload.reduce((groups, quote) => {
      const tradeType = quote.tradeType || "other";
      const group = groups.get(tradeType) ?? {
        tradeType,
        label: tradeLabel(tradeType),
        quotes: [],
      };
      group.quotes.push(quote);
      groups.set(tradeType, group);
      return groups;
    }, new Map<string, { tradeType: string; label: string; quotes: typeof quotePayload }>()),
  ).map(([, group]) => group);

  const consolidated = new Map<string, {
    materialId: number | null; description: string; category: string; unit: string;
    quantity: number; lineTotal: number; quoteIds: Set<number>;
  }>();
  for (const item of lineItems) {
    const key = item.materialId
      ? `material:${item.materialId}:${item.unit}`
      : `line:${item.description.trim().toLowerCase()}:${item.unit}:${item.unitPrice}`;
    const current = consolidated.get(key) ?? {
      materialId: item.materialId,
      description: item.description,
      category: item.category,
      unit: item.unit,
      quantity: 0,
      lineTotal: 0,
      quoteIds: new Set<number>(),
    };
    current.quantity += Number(item.quantity);
    current.lineTotal += Number(item.lineTotal);
    current.quoteIds.add(item.quoteId);
    consolidated.set(key, current);
  }

  return {
    id: project.project.id,
    title: project.project.title,
    status: project.project.status,
    customerId: project.project.customerId,
    customerName: project.customerName,
    notes: project.project.notes,
    builderMarginPct: Number(project.project.builderMarginPct),
    materialsSubtotal: Number(project.project.materialsSubtotal),
    labourSubtotal: Number(project.project.labourSubtotal),
    marginAmount: Number(project.project.marginAmount),
    gst: Number(project.project.gst),
    total: Number(project.project.total),
    hasActivePortalLink: Boolean(project.project.portalToken),
    complianceDisclaimer: STANDARD_NCC_DISCLAIMER,
    quotes: quotePayload,
    tradeGroups,
    billOfMaterials: Array.from(consolidated.values())
      .map((item) => ({
        materialId: item.materialId,
        description: item.description,
        category: item.category,
        quantity: roundMoney(item.quantity),
        unit: item.unit,
        unitPrice: item.quantity === 0 ? 0 : roundMoney(item.lineTotal / item.quantity),
        lineTotal: roundMoney(item.lineTotal),
        quoteCount: item.quoteIds.size,
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.description.localeCompare(b.description)),
    createdAt: project.project.createdAt.toISOString(),
    updatedAt: project.project.updatedAt.toISOString(),
  };
}

export async function getMasterProject(projectId: number, clerkUserId: string) {
  return loadMasterProject(projectId, clerkUserId);
}

export async function getMasterProjectByPortalToken(token: string) {
  const [project] = await db
    .select({ id: masterProjectsTable.id })
    .from(masterProjectsTable)
    .where(eq(masterProjectsTable.portalToken, token))
    .limit(1);
  return project ? loadMasterProject(project.id) : null;
}

export async function recalculateMasterProjectTotals(
  projectId: number,
  clerkUserId: string,
  client: MasterProjectDbClient = db,
): Promise<void> {
  const [project] = await client
    .select({ project: masterProjectsTable })
    .from(masterProjectsTable)
    .innerJoin(customersTable, and(
      eq(customersTable.id, masterProjectsTable.customerId),
      eq(customersTable.clerkUserId, clerkUserId),
    ))
    .where(eq(masterProjectsTable.id, projectId));
  if (!project) return;
  const quotes = await client.select().from(quotesTable).where(and(
    eq(quotesTable.masterProjectId, projectId),
    eq(quotesTable.clerkUserId, clerkUserId),
  ));
  const materialsSubtotal = roundMoney(quotes.reduce((sum, quote) => sum + Number(quote.materialsSubtotal), 0));
  const labourSubtotal = roundMoney(quotes.reduce((sum, quote) => sum + Number(quote.labourCost), 0));
  const totals = buildProjectPricing(materialsSubtotal, labourSubtotal, Number(project.project.builderMarginPct));
  await client.update(masterProjectsTable).set({
    materialsSubtotal: String(totals.materialsSubtotal),
    labourSubtotal: String(totals.labourSubtotal),
    marginAmount: String(totals.marginAmount),
    gst: String(totals.gst),
    total: String(totals.total),
  }).where(and(
    eq(masterProjectsTable.id, projectId),
    inArray(
      masterProjectsTable.customerId,
      client.select({ id: customersTable.id }).from(customersTable)
        .where(eq(customersTable.clerkUserId, clerkUserId)),
    ),
  ));
}

export async function listMasterProjects(clerkUserId: string) {
  const projects = await db
    .select({ project: masterProjectsTable, customerName: customersTable.name })
    .from(masterProjectsTable)
    .innerJoin(customersTable, and(
      eq(customersTable.id, masterProjectsTable.customerId),
      eq(customersTable.clerkUserId, clerkUserId),
    ))
    .orderBy(desc(masterProjectsTable.updatedAt));
  const quoteCounts = await db
    .select({ masterProjectId: quotesTable.masterProjectId })
    .from(quotesTable)
    .where(eq(quotesTable.clerkUserId, clerkUserId));
  return projects.map(({ project, customerName }) => ({
    id: project.id, title: project.title, status: project.status, customerId: project.customerId,
    customerName, builderMarginPct: Number(project.builderMarginPct),
    materialsSubtotal: Number(project.materialsSubtotal), labourSubtotal: Number(project.labourSubtotal),
    marginAmount: Number(project.marginAmount), gst: Number(project.gst), total: Number(project.total),
    quoteCount: quoteCounts.filter((quote) => quote.masterProjectId === project.id).length,
    createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(),
  }));
}