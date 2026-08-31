import { and, eq, isNotNull } from "drizzle-orm";
import { db, teamMembersTable } from "@workspace/db";

export async function getLinkedTeamMember(userId: string) {
  const [member] = await db
    .select({
      id: teamMembersTable.id,
      ownerClerkUserId: teamMembersTable.clerkUserId,
      role: teamMembersTable.role,
    })
    .from(teamMembersTable)
    .where(and(
      eq(teamMembersTable.linkedClerkUserId, userId),
      eq(teamMembersTable.active, true),
      isNotNull(teamMembersTable.clerkUserId),
    ))
    .limit(1);
  return member ?? null;
}