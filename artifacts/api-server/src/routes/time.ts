import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, timeEntriesTable, teamMembersTable, bookingsTable } from "@workspace/db";
import {
  ClockOnBody,
  ClockOffBody,
  AddManualTimeEntryBody,
  ListTimeEntriesForJobParams,
  ListTimeEntriesForMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function entryToJson(
  row: typeof timeEntriesTable.$inferSelect & {
    memberName: string | null;
    jobTitle: string | null;
  }
) {
  return {
    id: row.id,
    teamMemberId: row.teamMemberId,
    memberName: row.memberName,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    clockedOnAt: row.clockOn ? row.clockOn.toISOString() : null,
    clockedOffAt: row.clockOff ? row.clockOff.toISOString() : null,
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

async function enrichEntry(row: typeof timeEntriesTable.$inferSelect) {
  const [member] = await db
    .select({ name: teamMembersTable.name })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, row.teamMemberId));
  const [booking] = await db
    .select({ title: bookingsTable.title })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, row.jobId));
  return entryToJson({ ...row, memberName: member?.name ?? null, jobTitle: booking?.title ?? null });
}

router.post("/time/clock-on", async (req, res): Promise<void> => {
  const parsed = ClockOnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;

  const entries = await db
    .select()
    .from(timeEntriesTable)
    .where(eq(timeEntriesTable.teamMemberId, d.teamMemberId));

  const open = entries.find((e) => e.clockOff === null);
  if (open) {
    res.status(409).json({ error: "Already clocked on — clock off first" });
    return;
  }

  const [row] = await db
    .insert(timeEntriesTable)
    .values({
      teamMemberId: d.teamMemberId,
      jobId: d.jobId,
      clockOn: new Date(),
      notes: d.notes ?? null,
    })
    .returning();

  res.status(201).json(await enrichEntry(row));
});

router.post("/time/clock-off", async (req, res): Promise<void> => {
  const parsed = ClockOffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;

  const entries = await db
    .select()
    .from(timeEntriesTable)
    .where(eq(timeEntriesTable.teamMemberId, d.teamMemberId))
    .orderBy(asc(timeEntriesTable.clockOn));

  const open = entries.find(
    (e) => e.clockOff === null && e.jobId === d.jobId
  );

  if (!open) {
    res.status(404).json({ error: "No open clock-on found for this member/job" });
    return;
  }

  const now = new Date();
  const durationMinutes = open.clockOn
    ? Math.round((now.getTime() - open.clockOn.getTime()) / 60000)
    : 0;

  const [row] = await db
    .update(timeEntriesTable)
    .set({
      clockOff: now,
      durationMinutes,
      ...(d.notes ? { notes: d.notes } : {}),
    })
    .where(eq(timeEntriesTable.id, open.id))
    .returning();

  res.json(await enrichEntry(row));
});

router.post("/time/manual", async (req, res): Promise<void> => {
  const parsed = AddManualTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const clockedOn = d.clockOn ? new Date(d.clockOn) : null;
  const clockedOff = d.clockOff ? new Date(d.clockOff) : null;
  const durationMinutes = clockedOn && clockedOff
    ? Math.round((clockedOff.getTime() - clockedOn.getTime()) / 60000)
    : d.durationMinutes;
  const [row] = await db
    .insert(timeEntriesTable)
    .values({
      teamMemberId: d.teamMemberId,
      jobId: d.jobId,
      ...(clockedOn ? { clockOn: clockedOn } : {}),
      ...(clockedOff ? { clockOff: clockedOff } : {}),
      durationMinutes,
      manualEntry: true,
      ...(d.notes ? { notes: d.notes } : {}),
    })
    .returning();
  res.status(201).json(await enrichEntry(row));
});

router.get("/time/job/:jobId", async (req, res): Promise<void> => {
  const params = ListTimeEntriesForJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({
      e: timeEntriesTable,
      memberName: teamMembersTable.name,
      jobTitle: bookingsTable.title,
    })
    .from(timeEntriesTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.id, timeEntriesTable.teamMemberId))
    .leftJoin(bookingsTable, eq(bookingsTable.id, timeEntriesTable.jobId))
    .where(eq(timeEntriesTable.jobId, params.data.jobId))
    .orderBy(asc(timeEntriesTable.clockOn));
  res.json(rows.map((r) => entryToJson({ ...r.e, memberName: r.memberName, jobTitle: r.jobTitle })));
});

router.get("/time/member/:memberId", async (req, res): Promise<void> => {
  const params = ListTimeEntriesForMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({
      e: timeEntriesTable,
      memberName: teamMembersTable.name,
      jobTitle: bookingsTable.title,
    })
    .from(timeEntriesTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.id, timeEntriesTable.teamMemberId))
    .leftJoin(bookingsTable, eq(bookingsTable.id, timeEntriesTable.jobId))
    .where(eq(timeEntriesTable.teamMemberId, params.data.memberId))
    .orderBy(asc(timeEntriesTable.clockOn));
  res.json(rows.map((r) => entryToJson({ ...r.e, memberName: r.memberName, jobTitle: r.jobTitle })));
});

export default router;
