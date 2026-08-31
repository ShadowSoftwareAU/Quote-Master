import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, businessProfilesTable } from "@workspace/db";

const MASTER_BUILDER = "MASTER_BUILDER";

export async function requireMasterBuilder(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!process.env.CLERK_SECRET_KEY) {
    res.status(503).json({ error: "Clerk authentication is not configured" });
    return;
  }

  const auth = getAuth(req);
  const claims = auth.sessionClaims as Record<string, unknown> | null;
  const metadata =
    (claims?.public_metadata as Record<string, unknown> | undefined) ??
    (claims?.publicMetadata as Record<string, unknown> | undefined) ??
    (claims?.metadata as Record<string, unknown> | undefined);
  const role = metadata?.accessRole ?? metadata?.role;

  if (!auth.userId) {
    res.status(401).json({ error: "Authentication is required" });
    return;
  }
  if (role === MASTER_BUILDER) {
    next();
    return;
  }

  const [profile] = await db
    .select({ id: businessProfilesTable.id })
    .from(businessProfilesTable)
    .where(and(
      eq(businessProfilesTable.clerkUserId, auth.userId),
      eq(businessProfilesTable.role, "Owner"),
      eq(businessProfilesTable.isMasterBuilder, true),
    ))
    .limit(1);
  if (!profile) {
    res.status(403).json({ error: "MASTER_BUILDER access is required" });
    return;
  }

  next();
}