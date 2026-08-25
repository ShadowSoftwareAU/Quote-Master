import { desc, eq, inArray } from "drizzle-orm";
import {
  customersTable,
  db,
  masterProjectsTable,
  quoteLineItemsTable,
  quotesTable,
} from "@workspace/db";

const GST_RATE = 0.1;

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

export async function getMasterProject(projectId: number) {
  const [project] = await db
    .select({ project: masterProjectsTable, customerName: customersTable.name })
    .from(masterProjectsTable)
    .leftJoin(customersTable, eq(customersTable.id, masterProjectsTable.customerId))
    .where(eq(masterProjectsTable.id, projectId));
  if (!project) return null;

  const quotes = await db
    .select()
    .from(quotesTable)
    .where(eq(quotesTable.masterProjectId, projectId))
    .orderBy(desc(quotesTable.createdAt));
  const quoteIds = quotes.map((quote) => quote.id);
  const lineItems =
    quoteIds.length === 0
      ? []
      : await db
          .select()
          .from(quoteLineItemsTable)
          .where(inArray(quoteLineItemsTable.quoteId, quoteIds));

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
    quotes: quotes.map((quote) => ({
      id: quote.id, title: quote.title, status: quote.status, customerId: quote.customerId,
      tradeType: quote.tradeType, materialsSubtotal: Number(quote.materialsSubtotal),
      labourCost: Number(quote.labourCost), gst: Number(quote.gst), total: Number(quote.total),
      createdAt: quote.createdAt.toISOString(),
    })),
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

export async function recalculateMasterProjectTotals(projectId: number): Promise<void> {
  const [project] = await db.select().from(masterProjectsTable).where(eq(masterProjectsTable.id, projectId));
  if (!project) return;
  const quotes = await db.select().from(quotesTable).where(eq(quotesTable.masterProjectId, projectId));
  const materialsSubtotal = roundMoney(quotes.reduce((sum, quote) => sum + Number(quote.materialsSubtotal), 0));
  const labourSubtotal = roundMoney(quotes.reduce((sum, quote) => sum + Number(quote.labourCost), 0));
  const totals = buildProjectPricing(materialsSubtotal, labourSubtotal, Number(project.builderMarginPct));
  await db.update(masterProjectsTable).set({
    materialsSubtotal: String(totals.materialsSubtotal),
    labourSubtotal: String(totals.labourSubtotal),
    marginAmount: String(totals.marginAmount),
    gst: String(totals.gst),
    total: String(totals.total),
  }).where(eq(masterProjectsTable.id, projectId));
}

export async function listMasterProjects() {
  const projects = await db
    .select({ project: masterProjectsTable, customerName: customersTable.name })
    .from(masterProjectsTable)
    .leftJoin(customersTable, eq(customersTable.id, masterProjectsTable.customerId))
    .orderBy(desc(masterProjectsTable.updatedAt));
  const quoteCounts = await db.select({ masterProjectId: quotesTable.masterProjectId }).from(quotesTable);
  return projects.map(({ project, customerName }) => ({
    id: project.id, title: project.title, status: project.status, customerId: project.customerId,
    customerName, builderMarginPct: Number(project.builderMarginPct),
    materialsSubtotal: Number(project.materialsSubtotal), labourSubtotal: Number(project.labourSubtotal),
    marginAmount: Number(project.marginAmount), gst: Number(project.gst), total: Number(project.total),
    quoteCount: quoteCounts.filter((quote) => quote.masterProjectId === project.id).length,
    createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString(),
  }));
}