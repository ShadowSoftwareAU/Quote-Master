import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, businessProfilesTable, teamMembersTable } from "@workspace/db";
import { getAuthenticatedClerkUserId } from "./apiAuth";

export type BusinessRole = "Owner" | "Employee" | "Subcontractor";

function normaliseRole(value: string | null | undefined): BusinessRole | null {
  const role = value?.trim().toLowerCase();
  if (role === "owner") return "Owner";
  if (role === "employee") return "Employee";
  if (role === "subcontractor") return "Subcontractor";
  return null;
}

export async function getBusinessRole(userId: string): Promise<BusinessRole | null> {
  const [profile] = await db
    .select({ role: businessProfilesTable.role })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.clerkUserId, userId))
    .limit(1);
  const profileRole = normaliseRole(profile?.role);
  if (profileRole) return profileRole;

  const [member] = await db
    .select({ role: teamMembersTable.role })
    .from(teamMembersTable)
    .where(and(
      eq(teamMembersTable.clerkUserId, userId),
      eq(teamMembersTable.active, true),
    ))
    .limit(1);
  return normaliseRole(member?.role);
}

export function requireBusinessRole(...allowedRoles: BusinessRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let userId: string;
    try {
      userId = getAuthenticatedClerkUserId(req);
    } catch {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const role = await getBusinessRole(userId);
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: "Owner role is required" });
      return;
    }
    next();
  };
}

export const requireOwner = requireBusinessRole("Owner");