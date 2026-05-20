import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import {
  db,
  bookingsTable,
  customersTable,
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

const router: IRouter = Router();

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

async function loadBooking(id: number) {
  const [row] = await db
    .select({
      b: bookingsTable,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, eq(customersTable.id, bookingsTable.customerId))
    .where(eq(bookingsTable.id, id));
  if (!row) return null;
  return toJson({ ...row.b, customerName: row.customerName });
}

router.get("/bookings", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      b: bookingsTable,
      customerName: customersTable.name,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, eq(customersTable.id, bookingsTable.customerId))
    .orderBy(asc(bookingsTable.startAt));
  res.json(rows.map((r) => toJson({ ...r.b, customerName: r.customerName })));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [created] = await db
    .insert(bookingsTable)
    .values({
      title: d.title,
      customerId: d.customerId ?? null,
      quoteId: d.quoteId ?? null,
      siteAddress: d.siteAddress ?? null,
      notes: d.notes ?? null,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      status: d.status ?? "scheduled",
      photos: [],
    })
    .returning();
  const json = await loadBooking(created.id);
  res.status(201).json(json);
});

router.patch("/bookings/:id", async (req, res): Promise<void> => {
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
  const [row] = await db
    .update(bookingsTable)
    .set(update)
    .where(eq(bookingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const json = await loadBooking(row.id);
  res.json(json);
});

router.post("/bookings/:id/photos", async (req, res): Promise<void> => {
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
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const currentPhotos = (existing.photos as string[]) ?? [];
  const updatedPhotos = [...currentPhotos, body.data.objectPath];
  const [row] = await db
    .update(bookingsTable)
    .set({ photos: updatedPhotos })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();
  const json = await loadBooking(row.id);
  res.json(json);
});

router.delete("/bookings/:id/photos", async (req, res): Promise<void> => {
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
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const currentPhotos = (existing.photos as string[]) ?? [];
  const updatedPhotos = currentPhotos.filter((p) => p !== body.data.objectPath);
  const [row] = await db
    .update(bookingsTable)
    .set({ photos: updatedPhotos })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();
  const json = await loadBooking(row.id);
  res.json(json);
});

router.delete("/bookings/:id", async (req, res): Promise<void> => {
  const params = DeleteBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
