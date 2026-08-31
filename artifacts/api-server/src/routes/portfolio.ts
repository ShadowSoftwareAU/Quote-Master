import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, and } from "drizzle-orm";
import { db, portfolioEntriesTable, bookingsTable } from "@workspace/db";
import {
  CreatePortfolioEntryBody,
  UpdatePortfolioEntryParams,
  UpdatePortfolioEntryBody,
  DeletePortfolioEntryParams,
  AddPortfolioPhotoParams,
  AddPortfolioPhotoBody,
} from "@workspace/api-zod";
import { isPrivateObjectPathOwnedByUser } from "../lib/objectStorage";

const router: IRouter = Router();

function toJson(row: typeof portfolioEntriesTable.$inferSelect) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    title: row.title,
    description: row.description,
    deckType: row.deckType,
    dimensionText: row.dimensionText,
    materialsText: row.materialsText,
    beforePhotos: (row.beforePhotos as string[]) ?? [],
    afterPhotos: (row.afterPhotos as string[]) ?? [],
    testimonial: row.testimonial,
    customerName: row.customerName,
    rating: row.rating,
    isPublic: row.isPublic,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/portfolio", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select()
    .from(portfolioEntriesTable)
    .where(eq(portfolioEntriesTable.clerkUserId, userId))
    .orderBy(desc(portfolioEntriesTable.completedAt));
  res.json(rows.map(toJson));
});

router.post("/portfolio", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreatePortfolioEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  if (d.bookingId != null) {
    const [booking] = await db.select({ id: bookingsTable.id }).from(bookingsTable)
      .where(and(eq(bookingsTable.id, d.bookingId), eq(bookingsTable.clerkUserId, userId)));
    if (!booking) { res.status(400).json({ error: "Booking not found" }); return; }
  }
  const [row] = await db
    .insert(portfolioEntriesTable)
    .values({
      title: d.title,
      clerkUserId: userId,
      ...(d.bookingId ? { bookingId: d.bookingId } : {}),
      ...(d.description ? { description: d.description } : {}),
      ...(d.deckType ? { deckType: d.deckType } : {}),
      ...(d.dimensionText ? { dimensionText: d.dimensionText } : {}),
      ...(d.materialsText ? { materialsText: d.materialsText } : {}),
      ...(d.testimonial ? { testimonial: d.testimonial } : {}),
      ...(d.customerName ? { customerName: d.customerName } : {}),
      ...(d.rating !== undefined ? { rating: d.rating } : {}),
      ...(d.isPublic !== undefined ? { isPublic: d.isPublic } : {}),
      ...(d.completedAt ? { completedAt: new Date(d.completedAt) } : {}),
      beforePhotos: [],
      afterPhotos: [],
    })
    .returning();
  res.status(201).json(toJson(row));
});

router.patch("/portfolio/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdatePortfolioEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdatePortfolioEntryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const d = body.data;
  const [row] = await db
    .update(portfolioEntriesTable)
    .set({
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.deckType !== undefined ? { deckType: d.deckType } : {}),
      ...(d.dimensionText !== undefined ? { dimensionText: d.dimensionText } : {}),
      ...(d.materialsText !== undefined ? { materialsText: d.materialsText } : {}),
      ...(d.testimonial !== undefined ? { testimonial: d.testimonial } : {}),
      ...(d.customerName !== undefined ? { customerName: d.customerName } : {}),
      ...(d.rating !== undefined ? { rating: d.rating } : {}),
      ...(d.isPublic !== undefined ? { isPublic: d.isPublic } : {}),
      ...(d.completedAt !== undefined ? { completedAt: d.completedAt ? new Date(d.completedAt) : null } : {}),
    })
    .where(and(eq(portfolioEntriesTable.id, params.data.id), eq(portfolioEntriesTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Portfolio entry not found" });
    return;
  }
  res.json(toJson(row));
});

router.delete("/portfolio/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeletePortfolioEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(portfolioEntriesTable)
    .where(and(eq(portfolioEntriesTable.id, params.data.id), eq(portfolioEntriesTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Portfolio entry not found" });
    return;
  }
  res.json({ deleted: true });
});

router.post("/portfolio/:id/photos", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = AddPortfolioPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AddPortfolioPhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!isPrivateObjectPathOwnedByUser(body.data.objectPath, userId)) {
    res.status(400).json({ error: "Photo objectPath must belong to the authenticated user" });
    return;
  }
  const [existing] = await db
    .select()
    .from(portfolioEntriesTable)
    .where(and(eq(portfolioEntriesTable.id, params.data.id), eq(portfolioEntriesTable.clerkUserId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Portfolio entry not found" });
    return;
  }
  const isBefore = body.data.photoType === "before";
  const before = (existing.beforePhotos as string[]) ?? [];
  const after = (existing.afterPhotos as string[]) ?? [];
  const updated = isBefore
    ? { beforePhotos: [...before, body.data.objectPath] }
    : { afterPhotos: [...after, body.data.objectPath] };
  const [row] = await db
    .update(portfolioEntriesTable)
    .set(updated)
    .where(and(eq(portfolioEntriesTable.id, params.data.id), eq(portfolioEntriesTable.clerkUserId, userId)))
    .returning();
  res.json(toJson(row));
});

export default router;
