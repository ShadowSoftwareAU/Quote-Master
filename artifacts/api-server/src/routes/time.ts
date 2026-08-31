import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, asc, and, isNull, exists } from "drizzle-orm";
import {
  db,
  timeEntriesTable,
  teamMembersTable,
  bookingsTable,
  jobAssignmentsTable,
} from "@workspace/db";
import {
  ClockOnBody,
  ClockOffBody,
  AddManualTimeEntryBody,
  ListTimeEntriesForJobParams,
  ListTimeEntriesForMemberParams,
} from "@workspace/api-zod";
import { getBusinessRole } from "../middlewares/businessRoleAuth";
import { getLinkedTeamMember } from "../lib/assignmentAccess";

const router: IRouter = Router();

type LinkedMember = NonNullable<Awaited<ReturnType<typeof getLinkedTeamMember>>>;
type TimeAccess =
  | { kind: "owner"; userId: string }
  | { kind: "linked"; userId: string; member: LinkedMember }
  | { kind: "denied" };

async function resolveTimeAccess(userId: string): Promise<TimeAccess> {
  const member = await getLinkedTeamMember(userId);
  if (member) return { kind: "linked", userId, member };
  if (await getBusinessRole(userId) === "Subcontractor") return { kind: "denied" };
  return { kind: "owner", userId };
}

function memberScope(access: Exclude<TimeAccess, { kind: "denied" }>, memberId: number) {
  return access.kind === "linked"
    ? and(
        eq(teamMembersTable.id, access.member.id),
        eq(teamMembersTable.id, memberId),
        eq(teamMembersTable.clerkUserId, access.member.ownerClerkUserId!),
        eq(teamMembersTable.linkedClerkUserId, access.userId),
        eq(teamMembersTable.active, true),
      )
    : and(
        eq(teamMembersTable.id, memberId),
        eq(teamMembersTable.clerkUserId, access.userId),
      );
}

function bookingScope(access: Exclude<TimeAccess, { kind: "denied" }>, jobId: number) {
  return access.kind === "linked"
    ? and(
        eq(bookingsTable.id, jobId),
        eq(bookingsTable.clerkUserId, access.member.ownerClerkUserId!),
        exists(
          db
            .select({ id: jobAssignmentsTable.id })
            .from(jobAssignmentsTable)
            .where(and(
              eq(jobAssignmentsTable.jobId, bookingsTable.id),
              eq(jobAssignmentsTable.teamMemberId, access.member.id),
            )),
        ),
      )
    : and(
        eq(bookingsTable.id, jobId),
        eq(bookingsTable.clerkUserId, access.userId),
      );
}

function ownerId(access: Exclude<TimeAccess, { kind: "denied" }>) {
  return access.kind === "linked" ? access.member.ownerClerkUserId! : access.userId;
}

function linkedEntryScope(access: Exclude<TimeAccess, { kind: "denied" }>) {
  if (access.kind !== "linked") return undefined;
  return and(
    eq(timeEntriesTable.teamMemberId, access.member.id),
    eq(teamMembersTable.linkedClerkUserId, access.userId),
    eq(teamMembersTable.active, true),
    exists(
      db
        .select({ id: jobAssignmentsTable.id })
        .from(jobAssignmentsTable)
        .where(and(
          eq(jobAssignmentsTable.jobId, timeEntriesTable.jobId),
          eq(jobAssignmentsTable.teamMemberId, access.member.id),
        )),
    ),
  );
}

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

router.post("/time/clock-on", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = ClockOnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const access = await resolveTimeAccess(userId);
  if (access.kind === "denied") {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(memberScope(access, d.teamMemberId))
      .for("update");
    if (!member) return { error: "Team member not found" as const };

    if (access.kind === "linked") {
      const [assignment] = await tx
        .select({ id: jobAssignmentsTable.id })
        .from(jobAssignmentsTable)
        .where(and(
          eq(jobAssignmentsTable.jobId, d.jobId),
          eq(jobAssignmentsTable.teamMemberId, access.member.id),
        ))
        .for("update");
      if (!assignment) return { error: "Booking not found" as const };
    }

    const [booking] = await tx
      .select({ id: bookingsTable.id, title: bookingsTable.title })
      .from(bookingsTable)
      .where(bookingScope(access, d.jobId))
      .for("update");
    if (!booking) return { error: "Booking not found" as const };

    const [open] = await tx
      .select({ id: timeEntriesTable.id })
      .from(timeEntriesTable)
      .innerJoin(teamMembersTable, and(
        eq(teamMembersTable.id, timeEntriesTable.teamMemberId),
        eq(teamMembersTable.clerkUserId, ownerId(access)),
      ))
      .innerJoin(bookingsTable, and(
        eq(bookingsTable.id, timeEntriesTable.jobId),
        eq(bookingsTable.clerkUserId, ownerId(access)),
      ))
      .where(and(
        eq(timeEntriesTable.teamMemberId, d.teamMemberId),
        isNull(timeEntriesTable.clockOff),
      ))
      .limit(1);
    if (open) return { error: "Already clocked on — clock off first" as const };

    const [row] = await tx
      .insert(timeEntriesTable)
      .values({
        teamMemberId: member.id,
        jobId: booking.id,
        clockOn: new Date(),
        notes: d.notes ?? null,
      })
      .returning();

    return {
      row: entryToJson({
        ...row,
        memberName: member.name,
        jobTitle: booking.title,
      }),
    };
  });

  if ("error" in result) {
    const status = result.error === "Already clocked on — clock off first" ? 409 : 404;
    res.status(status).json({ error: result.error });
    return;
  }

  res.status(201).json(result.row);
});

router.post("/time/clock-off", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = ClockOffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const access = await resolveTimeAccess(userId);
  if (access.kind === "denied") {
    res.status(404).json({ error: "Team member not found" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(memberScope(access, d.teamMemberId))
      .for("update");
    if (!member) return { error: "Team member not found" as const };

    if (access.kind === "linked") {
      const [assignment] = await tx
        .select({ id: jobAssignmentsTable.id })
        .from(jobAssignmentsTable)
        .where(and(
          eq(jobAssignmentsTable.jobId, d.jobId),
          eq(jobAssignmentsTable.teamMemberId, access.member.id),
        ))
        .for("update");
      if (!assignment) return { error: "Booking not found" as const };
    }

    const [booking] = await tx
      .select({ id: bookingsTable.id, title: bookingsTable.title })
      .from(bookingsTable)
      .where(bookingScope(access, d.jobId))
      .for("update");
    if (!booking) return { error: "Booking not found" as const };

    const [open] = await tx
      .select({ entry: timeEntriesTable })
      .from(timeEntriesTable)
      .innerJoin(teamMembersTable, and(
        eq(teamMembersTable.id, timeEntriesTable.teamMemberId),
        eq(teamMembersTable.clerkUserId, ownerId(access)),
      ))
      .innerJoin(bookingsTable, and(
        eq(bookingsTable.id, timeEntriesTable.jobId),
        eq(bookingsTable.clerkUserId, ownerId(access)),
      ))
      .where(and(
        eq(timeEntriesTable.teamMemberId, member.id),
        eq(timeEntriesTable.jobId, booking.id),
        isNull(timeEntriesTable.clockOff),
      ))
      .orderBy(asc(timeEntriesTable.clockOn))
      .limit(1);
    if (!open) return { error: "No open clock-on found for this member/job" as const };

    const now = new Date();
    const durationMinutes = open.entry.clockOn
      ? Math.round((now.getTime() - open.entry.clockOn.getTime()) / 60000)
      : 0;

    const [row] = await tx
      .update(timeEntriesTable)
      .set({
        clockOff: now,
        durationMinutes,
        ...(d.notes ? { notes: d.notes } : {}),
      })
      .where(and(
        eq(timeEntriesTable.id, open.entry.id),
        eq(timeEntriesTable.teamMemberId, member.id),
        eq(timeEntriesTable.jobId, booking.id),
        isNull(timeEntriesTable.clockOff),
      ))
      .returning();
    if (!row) return { error: "No open clock-on found for this member/job" as const };

    return {
      row: entryToJson({
        ...row,
        memberName: member.name,
        jobTitle: booking.title,
      }),
    };
  });

  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.json(result.row);
});

router.post("/time/manual", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = AddManualTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const access = await resolveTimeAccess(userId);
  if (access.kind === "denied") {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  const clockedOn = d.clockOn ? new Date(d.clockOn) : null;
  const clockedOff = d.clockOff ? new Date(d.clockOff) : null;
  const durationMinutes = clockedOn && clockedOff
    ? Math.round((clockedOff.getTime() - clockedOn.getTime()) / 60000)
    : d.durationMinutes;

  const result = await db.transaction(async (tx) => {
    const [member] = await tx
      .select({ id: teamMembersTable.id, name: teamMembersTable.name })
      .from(teamMembersTable)
      .where(memberScope(access, d.teamMemberId))
      .for("update");
    if (!member) return { error: "Team member not found" as const };

    if (access.kind === "linked") {
      const [assignment] = await tx
        .select({ id: jobAssignmentsTable.id })
        .from(jobAssignmentsTable)
        .where(and(
          eq(jobAssignmentsTable.jobId, d.jobId),
          eq(jobAssignmentsTable.teamMemberId, access.member.id),
        ))
        .for("update");
      if (!assignment) return { error: "Booking not found" as const };
    }

    const [booking] = await tx
      .select({ id: bookingsTable.id, title: bookingsTable.title })
      .from(bookingsTable)
      .where(bookingScope(access, d.jobId))
      .for("update");
    if (!booking) return { error: "Booking not found" as const };

    const [row] = await tx
      .insert(timeEntriesTable)
      .values({
        teamMemberId: member.id,
        jobId: booking.id,
        ...(clockedOn ? { clockOn: clockedOn } : {}),
        ...(clockedOff ? { clockOff: clockedOff } : {}),
        durationMinutes,
        manualEntry: true,
        ...(d.notes ? { notes: d.notes } : {}),
      })
      .returning();

    return {
      row: entryToJson({
        ...row,
        memberName: member.name,
        jobTitle: booking.title,
      }),
    };
  });

  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.status(201).json(result.row);
});

router.get("/time/job/:jobId", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = ListTimeEntriesForJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const access = await resolveTimeAccess(userId);
  if (access.kind === "denied") {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const [booking] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(bookingScope(access, params.data.jobId));
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const rows = await db
    .select({
      e: timeEntriesTable,
      memberName: teamMembersTable.name,
      jobTitle: bookingsTable.title,
    })
    .from(timeEntriesTable)
    .innerJoin(teamMembersTable, and(
      eq(teamMembersTable.id, timeEntriesTable.teamMemberId),
      eq(teamMembersTable.clerkUserId, ownerId(access)),
    ))
    .innerJoin(bookingsTable, and(
      eq(bookingsTable.id, timeEntriesTable.jobId),
      eq(bookingsTable.clerkUserId, ownerId(access)),
    ))
    .where(and(
      eq(timeEntriesTable.jobId, params.data.jobId),
      linkedEntryScope(access),
    ))
    .orderBy(asc(timeEntriesTable.clockOn));
  res.json(rows.map((r) => entryToJson({ ...r.e, memberName: r.memberName, jobTitle: r.jobTitle })));
});

router.get("/time/member/:memberId", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const params = ListTimeEntriesForMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const access = await resolveTimeAccess(userId);
  if (access.kind === "denied") {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  const [member] = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(memberScope(access, params.data.memberId));
  if (!member) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  const rows = await db
    .select({
      e: timeEntriesTable,
      memberName: teamMembersTable.name,
      jobTitle: bookingsTable.title,
    })
    .from(timeEntriesTable)
    .innerJoin(teamMembersTable, and(
      eq(teamMembersTable.id, timeEntriesTable.teamMemberId),
      eq(teamMembersTable.clerkUserId, ownerId(access)),
    ))
    .innerJoin(bookingsTable, and(
      eq(bookingsTable.id, timeEntriesTable.jobId),
      eq(bookingsTable.clerkUserId, ownerId(access)),
    ))
    .where(and(
      eq(timeEntriesTable.teamMemberId, params.data.memberId),
      linkedEntryScope(access),
    ))
    .orderBy(asc(timeEntriesTable.clockOn));
  res.json(rows.map((r) => entryToJson({ ...r.e, memberName: r.memberName, jobTitle: r.jobTitle })));
});

export default router;
