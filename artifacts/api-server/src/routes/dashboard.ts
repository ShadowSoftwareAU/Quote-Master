import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { sql, eq, desc, asc, gte, inArray, and } from "drizzle-orm";
import {
  db,
  quotesTable,
  quoteLineItemsTable,
  bookingsTable,
  customersTable,
  materialsTable,
} from "@workspace/db";
import { requireOwner } from "../middlewares/businessRoleAuth";
import { getAnalyticsOverview } from "../services/analytics";

const router: IRouter = Router();

router.get("/analytics/overview", requireOwner, async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json(await getAnalyticsOverview(clerkUserId));
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const now = new Date();

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status in ('draft','sent'))::int`,
      accepted: sql<number>`count(*) filter (where status = 'accepted')::int`,
      value: sql<number>`coalesce(sum(total), 0)::float`,
    })
    .from(quotesTable)
    .where(eq(quotesTable.clerkUserId, clerkUserId));

  const [bookingCount] = await db
    .select({
      upcoming: sql<number>`count(*) filter (where start_at >= now() and status <> 'cancelled')::int`,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.clerkUserId, clerkUserId));

  const [customerCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(customersTable)
    .where(eq(customersTable.clerkUserId, clerkUserId));

  const recentQuotesRows = await db
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
    .leftJoin(customersTable, and(
      eq(customersTable.id, quotesTable.customerId),
      eq(customersTable.clerkUserId, clerkUserId),
    ))
    .where(eq(quotesTable.clerkUserId, clerkUserId))
    .orderBy(desc(quotesTable.createdAt))
    .limit(5);

  const upcomingBookingRows = await db
    .select({
      b: bookingsTable,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, and(
      eq(customersTable.id, bookingsTable.customerId),
      eq(customersTable.clerkUserId, clerkUserId),
    ))
    .where(and(
      eq(bookingsTable.clerkUserId, clerkUserId),
      gte(bookingsTable.startAt, now),
    ))
    .orderBy(asc(bookingsTable.startAt))
    .limit(5);

  const acceptedQuoteIds = await db
    .select({ id: quotesTable.id })
    .from(quotesTable)
    .where(and(
      eq(quotesTable.clerkUserId, clerkUserId),
      eq(quotesTable.status, "accepted"),
    ));

  let grossProfit = 0;
  let totalTradeCost = 0;

  if (acceptedQuoteIds.length > 0) {
    const ids = acceptedQuoteIds.map((q) => q.id);
    const lineItems = await db
      .select({
        lineTotal: quoteLineItemsTable.lineTotal,
        materialId: quoteLineItemsTable.materialId,
        quantity: quoteLineItemsTable.quantity,
      })
      .from(quoteLineItemsTable)
      .where(inArray(quoteLineItemsTable.quoteId, ids));

    const materialIds = lineItems
      .map((l) => l.materialId)
      .filter((id): id is number => id !== null);

    const materialsWithCost = materialIds.length > 0
      ? await db
          .select({ id: materialsTable.id, tradeCost: materialsTable.tradeCost })
          .from(materialsTable)
          .where(and(
            inArray(materialsTable.id, materialIds),
            eq(materialsTable.clerkUserId, clerkUserId),
          ))
      : [];

    const tradeCostMap = new Map(
      materialsWithCost.map((m) => [m.id, m.tradeCost ? Number(m.tradeCost) : null]),
    );

    const totalRetail = lineItems.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    const tradeCostSum = lineItems.reduce((sum, l) => {
      const tc = l.materialId !== null ? tradeCostMap.get(l.materialId) : null;
      if (tc !== null && tc !== undefined) {
        return sum + tc * Number(l.quantity);
      }
      return sum + Number(l.lineTotal) * 0.7;
    }, 0);

    totalTradeCost = Math.round(tradeCostSum * 100) / 100;
    grossProfit = Math.round((totalRetail - tradeCostSum) * 100) / 100;
  }

  res.json({
    activeQuoteCount: counts.active,
    acceptedQuoteCount: counts.accepted,
    totalQuoteValue: Number(counts.value),
    grossProfit,
    totalTradeCost,
    upcomingBookingCount: bookingCount.upcoming,
    customerCount: customerCount.c,
    recentQuotes: recentQuotesRows.map((r) => ({
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
    upcomingBookings: upcomingBookingRows.map((r) => ({
      id: r.b.id,
      title: r.b.title,
      customerId: r.b.customerId,
      customerName: r.customerName,
      quoteId: r.b.quoteId,
      siteAddress: r.b.siteAddress,
      notes: r.b.notes,
      startAt: r.b.startAt.toISOString(),
      endAt: r.b.endAt.toISOString(),
      status: r.b.status,
      photos: (r.b.photos as string[]) ?? [],
      createdAt: r.b.createdAt.toISOString(),
    })),
  });
});

router.get("/dashboard/pnl", requireOwner, async (req, res): Promise<void> => {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) { res.status(401).json({ error: "Unauthorized" }); return; }
  // Pull all accepted + sent quotes with customer names
  const quoteRows = await db
    .select({
      id: quotesTable.id,
      title: quotesTable.title,
      status: quotesTable.status,
      customerName: customersTable.name,
      labourCost: quotesTable.labourCost,
      materialsSubtotal: quotesTable.materialsSubtotal,
      gst: quotesTable.gst,
      createdAt: quotesTable.createdAt,
    })
    .from(quotesTable)
    .leftJoin(customersTable, and(
      eq(customersTable.id, quotesTable.customerId),
      eq(customersTable.clerkUserId, clerkUserId),
    ))
    .where(and(
      eq(quotesTable.clerkUserId, clerkUserId),
      sql`${quotesTable.status} in ('accepted', 'sent', 'draft')`,
    ))
    .orderBy(desc(quotesTable.createdAt));

  if (quoteRows.length === 0) {
    res.json({ jobs: [], monthly: [], totals: { revenue: 0, tradeCost: 0, labourCost: 0, grossProfit: 0, marginPct: 0, jobCount: 0 } });
    return;
  }

  const quoteIds = quoteRows.map((q) => q.id);

  // Fetch all line items for these quotes
  const lineItems = await db
    .select({
      quoteId: quoteLineItemsTable.quoteId,
      materialId: quoteLineItemsTable.materialId,
      quantity: quoteLineItemsTable.quantity,
      lineTotal: quoteLineItemsTable.lineTotal,
    })
    .from(quoteLineItemsTable)
    .where(inArray(quoteLineItemsTable.quoteId, quoteIds));

  // Fetch trade costs for all referenced materials
  const materialIds = [...new Set(lineItems.map((l) => l.materialId).filter((id): id is number => id !== null))];
  const tradeCostMap = new Map<number, number | null>();
  if (materialIds.length > 0) {
    const mats = await db
      .select({ id: materialsTable.id, tradeCost: materialsTable.tradeCost })
      .from(materialsTable)
      .where(and(
        inArray(materialsTable.id, materialIds),
        eq(materialsTable.clerkUserId, clerkUserId),
      ));
    for (const m of mats) {
      tradeCostMap.set(m.id, m.tradeCost ? Number(m.tradeCost) : null);
    }
  }

  // Group line items by quote
  const linesByQuote = new Map<number, typeof lineItems>();
  for (const l of lineItems) {
    const arr = linesByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    linesByQuote.set(l.quoteId, arr);
  }

  // Build per-job P&L rows
  const jobs = quoteRows.map((q) => {
    const lines = linesByQuote.get(q.id) ?? [];
    const labourCost = Number(q.labourCost);
    const revenue = Number(q.materialsSubtotal) + labourCost;

    let tradeCostIsEstimated = false;
    const tradeCostSum = lines.reduce((sum, l) => {
      const tc = l.materialId !== null ? tradeCostMap.get(l.materialId) ?? null : null;
      if (tc !== null) {
        return sum + tc * Number(l.quantity);
      }
      tradeCostIsEstimated = true;
      return sum + Number(l.lineTotal) * 0.7; // 30% margin assumption
    }, 0);

    const grossProfit = revenue - tradeCostSum - labourCost;
    const marginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

    return {
      quoteId: q.id,
      title: q.title,
      customerName: q.customerName ?? "Unknown",
      status: q.status,
      createdAt: q.createdAt.toISOString(),
      revenue: Math.round(revenue * 100) / 100,
      tradeCost: Math.round(tradeCostSum * 100) / 100,
      labourCost: Math.round(labourCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      marginPct,
      tradeCostIsEstimated,
    };
  });

  // Monthly rollup (use createdAt month)
  const monthMap = new Map<string, { revenue: number; tradeCost: number; labourCost: number; grossProfit: number; jobCount: number }>();
  for (const j of jobs) {
    const month = j.createdAt.slice(0, 7); // YYYY-MM
    const existing = monthMap.get(month) ?? { revenue: 0, tradeCost: 0, labourCost: 0, grossProfit: 0, jobCount: 0 };
    monthMap.set(month, {
      revenue: existing.revenue + j.revenue,
      tradeCost: existing.tradeCost + j.tradeCost,
      labourCost: existing.labourCost + j.labourCost,
      grossProfit: existing.grossProfit + j.grossProfit,
      jobCount: existing.jobCount + 1,
    });
  }

  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      revenue: Math.round(d.revenue * 100) / 100,
      tradeCost: Math.round(d.tradeCost * 100) / 100,
      labourCost: Math.round(d.labourCost * 100) / 100,
      grossProfit: Math.round(d.grossProfit * 100) / 100,
      marginPct: d.revenue > 0 ? Math.round((d.grossProfit / d.revenue) * 1000) / 10 : 0,
      jobCount: d.jobCount,
    }));

  // Overall totals
  const totals = jobs.reduce(
    (acc, j) => ({
      revenue: acc.revenue + j.revenue,
      tradeCost: acc.tradeCost + j.tradeCost,
      labourCost: acc.labourCost + j.labourCost,
      grossProfit: acc.grossProfit + j.grossProfit,
      jobCount: acc.jobCount + 1,
    }),
    { revenue: 0, tradeCost: 0, labourCost: 0, grossProfit: 0, jobCount: 0 },
  );

  res.json({
    jobs,
    monthly,
    totals: {
      ...totals,
      revenue: Math.round(totals.revenue * 100) / 100,
      tradeCost: Math.round(totals.tradeCost * 100) / 100,
      labourCost: Math.round(totals.labourCost * 100) / 100,
      grossProfit: Math.round(totals.grossProfit * 100) / 100,
      marginPct: totals.revenue > 0 ? Math.round((totals.grossProfit / totals.revenue) * 1000) / 10 : 0,
    },
  });
});

export default router;
