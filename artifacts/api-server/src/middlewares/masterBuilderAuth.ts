import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

const MASTER_BUILDER = "MASTER_BUILDER";

export function requireMasterBuilder(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
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
  if (role !== MASTER_BUILDER) {
    res.status(403).json({ error: "MASTER_BUILDER access is required" });
    return;
  }

  next();
}