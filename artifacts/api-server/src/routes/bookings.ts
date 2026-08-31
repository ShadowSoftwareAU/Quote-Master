import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, asc, and } from "drizzle-orm";
import {
  db,
  bookingsTable,
  customersTable,
  quotesTable,
} from "@workspace/db";
import {
  CreateBookingBody,
  UpdateBookingBody,
  UpdateBookingParams,
  DeleteBookingParams,
  AddBookingPhotoBody,
  AddBookingPhotoParams,
  RemoveBookingPhotoBody,
  RemoveBookingPhotoParams,
} from "@workspace/api-zod";
import { isPrivateObjectPathOwnedByUser } from "../lib/objectStorage";
import { requireBusinessRole } from "../middlewares/businessRoleAuth";

const router: IRouter = Router();
const requireBookingManager = requireBusinessRole("Owner", "Employee");

function toJson(row: typeof bookingsTable.$inferSelect & { customerName: string | null }) {
  return {
    id: row.id,
    title: row.title,
    customerId: row.customerId,
    customerName: row.customerName,
    quoteId: row.quoteId,
    siteAddress: row.siteAddress,
    notes: row.notes,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: row.status,
    photos: (row.photos as string[]) ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadBooking(id: number, userId: string) {
  const [row] = await db
    .select({
      b: bookingsTable,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, and(eq(customersTable.id, bookingsTable.customerId), eq(customersTable.clerkUserId, userId)))
    .where(and(eq(bookingsTable.id, id), eq(bookingsTable.clerkUserId, userId)));
  if (!row) return null;
  return toJson({ ...row.b, customerName: row.customerName });
}

router.get("/bookings", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select({
      b: bookingsTable,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, and(eq(customersTable.id, bookingsTable.customerId), eq(customersTable.clerkUserId, userId)))
    .where(eq(bookingsTable.clerkUserId, userId))
    .orderBy(asc(bookingsTable.startAt));
  res.json(rows.map((r) => toJson({ ...r.b, customerName: r.customerName })));
});

router.post("/bookings", requireBookingManager, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const result = await db.transaction(async (tx) => {
    if (d.customerId != null) {
      const [customer] = await tx.select({ id: customersTable.id }).from(customersTable)
        .where(and(eq(customersTable.id, d.customerId), eq(customersTable.clerkUserId, userId)));
      if (!customer) return { error: "Customer not found" } as const;
    }
    if (d.quoteId != null) {
      const [quote] = await tx.select({ id: quotesTable.id }).from(quotesTable)
        .where(and(eq(quotesTable.id, d.quoteId), eq(quotesTable.clerkUserId, userId)));
      if (!quote) return { error: "Quote not found" } as const;
    }
    const [created] = await tx.insert(bookingsTable).values({
      title: d.title,
      clerkUserId: userId,
      customerId: d.customerId ?? null,
      quoteId: d.quoteId ?? null,
      siteAddress: d.siteAddress ?? null,
      notes: d.notes ?? null,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      status: d.status ?? "scheduled",
      photos: [],
    }).returning();
    return { created } as const;
  });
  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  const { created } = result;
  const json = await loadBooking(created.id, userId);
  if (!json) { res.status(404).json({ error: "Booking not found" }); return; }
  res.status(201).json(json);
});

router.patch("/bookings/:id", requireBookingManager, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdateBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateBookingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const d = body.data;
  const update: Record<string, unknown> = {};
  if (d.title !== undefined) update.title = d.title;
  if (d.customerId !== undefined) update.customerId = d.customerId;
  if (d.quoteId !== undefined) update.quoteId = d.quoteId;
  if (d.siteAddress !== undefined) update.siteAddress = d.siteAddress;
  if (d.notes !== undefined) update.notes = d.notes;
  if (d.startAt !== undefined) update.startAt = new Date(d.startAt);
  if (d.endAt !== undefined) update.endAt = new Date(d.endAt);
  if (d.status !== undefined) update.status = d.status;
  const result = await db.transaction(async (tx) => {
    if (d.customerId != null) {
      const [customer] = await tx.select({ id: customersTable.id }).from(customersTable)
        .where(and(eq(customersTable.id, d.customerId), eq(customersTable.clerkUserId, userId)));
      if (!customer) return { ok: false, error: "Customer not found", status: 400 } as const;
    }
    if (d.quoteId != null) {
      const [quote] = await tx.select({ id: quotesTable.id }).from(quotesTable)
        .where(and(eq(quotesTable.id, d.quoteId), eq(quotesTable.clerkUserId, userId)));
      if (!quote) return { ok: false, error: "Quote not found", status: 400 } as const;
    }
    const [row] = await tx.update(bookingsTable).set(update)
      .where(and(eq(bookingsTable.id, params.data.id), eq(bookingsTable.clerkUserId, userId)))
      .returning();
    return row
      ? { ok: true, row } as const
      : { ok: false, error: "Booking not found", status: 404 } as const;
  });
  if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
  const { row } = result;
  const json = await loadBooking(row.id, userId);
  if (!json) { res.status(404).json({ error: "Booking not found" }); return; }
  res.json(json);
});

router.post("/bookings/:id/photos", requireBookingManager, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = AddBookingPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AddBookingPhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!isPrivateObjectPathOwnedByUser(body.data.objectPath, userId)) {
    res.status(400).json({ error: "Photo objectPath must belong to the authenticated user" });
    return;
  }
  const [existing] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, params.data.id), eq(bookingsTable.clerkUserId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const currentPhotos = (existing.photos as string[]) ?? [];
  const updatedPhotos = [...currentPhotos, body.data.objectPath];
  const [row] = await db
    .update(bookingsTable)
    .set({ photos: updatedPhotos })
    .where(and(eq(bookingsTable.id, params.data.id), eq(bookingsTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const json = await loadBooking(row.id, userId);
  if (!json) { res.status(404).json({ error: "Booking not found" }); return; }
  res.json(json);
});

router.delete("/bookings/:id/photos", requireBookingManager, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = RemoveBookingPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = RemoveBookingPhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!isPrivateObjectPathOwnedByUser(body.data.objectPath, userId)) {
    res.status(400).json({ error: "Photo objectPath must belong to the authenticated user" });
    return;
  }
  const [existing] = await db.select().from(bookingsTable).where(and(eq(bookingsTable.id, params.data.id), eq(bookingsTable.clerkUserId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const currentPhotos = (existing.photos as string[]) ?? [];
  const updatedPhotos = currentPhotos.filter((p) => p !== body.data.objectPath);
  const [row] = await db
    .update(bookingsTable)
    .set({ photos: updatedPhotos })
    .where(and(eq(bookingsTable.id, params.data.id), eq(bookingsTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const json = await loadBooking(row.id, userId);
  if (!json) { res.status(404).json({ error: "Booking not found" }); return; }
  res.json(json);
});

router.delete("/bookings/:id", requireBookingManager, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(bookingsTable)
    .where(and(eq(bookingsTable.id, params.data.id), eq(bookingsTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.json({ deleted: true });
});

export default router;
