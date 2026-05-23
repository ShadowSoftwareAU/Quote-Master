import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
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

router.get("/team", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(teamMembersTable)
    .orderBy(asc(teamMembersTable.name));
  res.json(rows.map(memberToJson));
});

router.post("/team", async (req, res): Promise<void> => {
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
      ...(d.role ? { role: d.role } : {}),
      ...(d.phone ? { phone: d.phone } : {}),
      ...(d.email ? { email: d.email } : {}),
      ...(d.pin ? { pin: d.pin } : {}),
    })
    .returning();
  res.status(201).json(memberToJson(row));
});

router.patch("/team/:id", async (req, res): Promise<void> => {
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
    .where(eq(teamMembersTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.json(memberToJson(row));
});

router.delete("/team/:id", async (req, res): Promise<void> => {
  const params = DeleteTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(teamMembersTable)
    .set({ active: false })
    .where(eq(teamMembersTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Team member not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/team/:memberId/assign/:jobId", async (req, res): Promise<void> => {
  const params = AssignTeamMemberToJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AssignTeamMemberToJobBody.safeParse(req.body);
  const roleOnJob = body.success ? (body.data.roleOnJob ?? null) : null;

  const [existing] = await db
    .select()
    .from(jobAssignmentsTable)
    .where(
      eq(jobAssignmentsTable.teamMemberId, params.data.memberId)
    );

  if (existing && existing.jobId === params.data.jobId) {
    res.status(409).json({ error: "Already assigned" });
    return;
  }

  const [row] = await db
    .insert(jobAssignmentsTable)
    .values({
      teamMemberId: params.data.memberId,
      jobId: params.data.jobId,
      roleOnJob,
    })
    .returning();

  const member = await db
    .select({ name: teamMembersTable.name })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.id, row.teamMemberId));
  const booking = await db
    .select({ title: bookingsTable.title })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, row.jobId));

  res.status(201).json(
    assignmentToJson({
      ...row,
      memberName: member[0]?.name ?? null,
      jobTitle: booking[0]?.title ?? null,
    })
  );
});

router.get("/bookings/:jobId/assignments", async (req, res): Promise<void> => {
  const params = ListJobAssignmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({
      a: jobAssignmentsTable,
      memberName: teamMembersTable.name,
      jobTitle: bookingsTable.title,
    })
    .from(jobAssignmentsTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.id, jobAssignmentsTable.teamMemberId))
    .leftJoin(bookingsTable, eq(bookingsTable.id, jobAssignmentsTable.jobId))
    .where(eq(jobAssignmentsTable.jobId, params.data.jobId));

  res.json(
    rows.map((r) =>
      assignmentToJson({ ...r.a, memberName: r.memberName, jobTitle: r.jobTitle })
    )
  );
});

router.delete("/bookings/:jobId/assignments", async (req, res): Promise<void> => {
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
  await db
    .delete(jobAssignmentsTable)
    .where(eq(jobAssignmentsTable.teamMemberId, body.data.teamMemberId));
  res.sendStatus(204);
});

export default router;
