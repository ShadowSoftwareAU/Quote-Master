import { Router, type IRouter } from "express";
import { sql, eq, desc, asc, gte, ne } from "drizzle-orm";
import {
  db,
  quotesTable,
  bookingsTable,
  customersTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where status in ('draft','sent'))::int`,
      accepted: sql<number>`count(*) filter (where status = 'accepted')::int`,
      value: sql<number>`coalesce(sum(total), 0)::float`,
    })
    .from(quotesTable);

  const [bookingCount] = await db
    .select({
      upcoming: sql<number>`count(*) filter (where start_at >= now() and status <> 'cancelled')::int`,
    })
    .from(bookingsTable);

  const [customerCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(customersTable);

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
    .leftJoin(customersTable, eq(customersTable.id, quotesTable.customerId))
    .orderBy(desc(quotesTable.createdAt))
    .limit(5);

  const upcomingBookingRows = await db
    .select({
      b: bookingsTable,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, eq(customersTable.id, bookingsTable.customerId))
    .where(gte(bookingsTable.startAt, now))
    .orderBy(asc(bookingsTable.startAt))
    .limit(5);
  void ne;

  res.json({
    activeQuoteCount: counts.active,
    acceptedQuoteCount: counts.accepted,
    totalQuoteValue: Number(counts.value),
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
      createdAt: r.b.createdAt.toISOString(),
    })),
  });
});

export default router;
