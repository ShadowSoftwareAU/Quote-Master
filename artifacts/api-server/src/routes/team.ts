import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, asc, and } from "drizzle-orm";
import {
  db,
  teamMembersTable,
  jobAssignmentsTable,
  bookingsTable,
} from "@workspace/db";
import {
  CreateTeamMemberBody,
  UpdateTeamMemberParams,
  UpdateTeamMemberBody,
  DeleteTeamMemberParams,
  AssignTeamMemberToJobParams,
  AssignTeamMemberToJobBody,
  ListJobAssignmentsParams,
  RemoveJobAssignmentParams,
  RemoveJobAssignmentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function memberToJson(row: typeof teamMembersTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    pin: row.pin,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

function assignmentToJson(
  row: typeof jobAssignmentsTable.$inferSelect & {
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
    roleOnJob: row.roleOnJob,
    assignedAt: row.assignedAt.toISOString(),
  };
}

router.get("/team", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select()
    .from(teamMembersTable)
    .where(eq(teamMembersTable.clerkUserId, userId))
    .orderBy(asc(teamMembersTable.name));
  res.json(rows.map(memberToJson));
});

router.post("/team", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateTeamMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(teamMembersTable)
    .values({
      name: d.name,
      clerkUserId: userId,
      ...(d.role ? { role: d.role } : {}),
      ...(d.phone ? { phone: d.phone } : {}),
      ...(d.email ? { email: d.email } : {}),
      ...(d.pin ? { pin: d.pin } : {}),
    })
    .returning();
  res.status(201).json(memberToJson(row));
});

router.patch("/team/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdateTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateTeamMemberBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const d = body.data;
  const [row] = await db
    .update(teamMembersTable)
    .set({
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.role !== undefined ? { role: d.role } : {}),
      ...(d.phone !== undefined ? { phone: d.phone } : {}),
      ...(d.email !== undefined ? { email: d.email } : {}),
      ...(d.pin !== undefined ? { pin: d.pin } : {}),
    })
    .where(and(eq(teamMembersTable.id, params.data.id), eq(teamMembersTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.json(memberToJson(row));
});

router.delete("/team/:id", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(teamMembersTable)
    .set({ active: false })
    .where(and(eq(teamMembersTable.id, params.data.id), eq(teamMembersTable.clerkUserId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.json({ deleted: true });
});

router.post("/team/:memberId/assign/:jobId", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = AssignTeamMemberToJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AssignTeamMemberToJobBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const roleOnJob = body.data.roleOnJob ?? null;

  const result = await db.transaction(async (tx) => {
    const [member] = await tx.select({ name: teamMembersTable.name }).from(teamMembersTable)
      .where(and(eq(teamMembersTable.id, params.data.memberId), eq(teamMembersTable.clerkUserId, userId)));
    if (!member) return { ok: false, error: "Team member not found", status: 404 } as const;
    const [booking] = await tx.select({ title: bookingsTable.title }).from(bookingsTable)
      .where(and(eq(bookingsTable.id, params.data.jobId), eq(bookingsTable.clerkUserId, userId)));
    if (!booking) return { ok: false, error: "Booking not found", status: 404 } as const;
    const [existing] = await tx
      .select()
      .from(jobAssignmentsTable)
      .where(and(
        eq(jobAssignmentsTable.teamMemberId, params.data.memberId),
        eq(jobAssignmentsTable.jobId, params.data.jobId),
      ));
    if (existing) return { ok: false, error: "Already assigned", status: 409 } as const;
    const [row] = await tx.insert(jobAssignmentsTable).values({
      teamMemberId: params.data.memberId,
      jobId: params.data.jobId,
      roleOnJob,
    }).returning();
    if (!row) return { ok: false, error: "Assignment could not be created", status: 500 } as const;
    return { ok: true, row, member, booking } as const;
  });
  if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
  res.status(201).json(
    assignmentToJson({
      ...result.row,
      memberName: result.member.name,
      jobTitle: result.booking.title,
    })
  );
});

router.get("/bookings/:jobId/assignments", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = ListJobAssignmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [booking] = await db.select({ id: bookingsTable.id }).from(bookingsTable)
    .where(and(eq(bookingsTable.id, params.data.jobId), eq(bookingsTable.clerkUserId, userId)));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  const rows = await db
    .select({
      a: jobAssignmentsTable,
      memberName: teamMembersTable.name,
      jobTitle: bookingsTable.title,
    })
    .from(jobAssignmentsTable)
    .innerJoin(teamMembersTable, and(eq(teamMembersTable.id, jobAssignmentsTable.teamMemberId), eq(teamMembersTable.clerkUserId, userId)))
    .innerJoin(bookingsTable, and(eq(bookingsTable.id, jobAssignmentsTable.jobId), eq(bookingsTable.clerkUserId, userId)))
    .where(eq(jobAssignmentsTable.jobId, params.data.jobId));

  res.json(
    rows.map((r) =>
      assignmentToJson({ ...r.a, memberName: r.memberName, jobTitle: r.jobTitle })
    )
  );
});

router.delete("/bookings/:jobId/assignments", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = RemoveJobAssignmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = RemoveJobAssignmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [booking] = await tx.select({ id: bookingsTable.id }).from(bookingsTable)
      .where(and(eq(bookingsTable.id, params.data.jobId), eq(bookingsTable.clerkUserId, userId)));
    if (!booking) return { error: "Booking not found" } as const;
    const [member] = await tx.select({ id: teamMembersTable.id }).from(teamMembersTable)
      .where(and(eq(teamMembersTable.id, body.data.teamMemberId), eq(teamMembersTable.clerkUserId, userId)));
    if (!member) return { error: "Team member not found" } as const;
    const [deleted] = await tx.delete(jobAssignmentsTable).where(and(
      eq(jobAssignmentsTable.teamMemberId, body.data.teamMemberId),
      eq(jobAssignmentsTable.jobId, params.data.jobId),
    )).returning();
    return deleted ? { deleted } as const : { error: "Assignment not found" } as const;
  });
  if ("error" in result) { res.status(404).json({ error: result.error }); return; }
  res.json({ deleted: true });
});

export default router;
