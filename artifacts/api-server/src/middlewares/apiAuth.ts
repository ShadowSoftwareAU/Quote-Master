import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { SetQuoteStatusBody, UpdateQuoteBody } from "@workspace/api-zod";

const PUBLIC_QUOTE_PORTAL_PATH = /^\/quotes\/\d+\/portal$/;
const PUBLIC_QUOTE_UPDATE_PATH = /^\/quotes\/\d+$/;
const PUBLIC_QUOTE_STATUS_PATH = /^\/quotes\/\d+\/status$/;
const PUBLIC_UPGRADE_FIELDS = new Set(["deckBoardType", "balustradeType"]);

function objectKeys(value: unknown): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value);
}

function isPublicUpgradeRequest(req: Request): boolean {
  if (!PUBLIC_QUOTE_UPDATE_PATH.test(req.path)) {
    return false;
  }

  const keys = objectKeys(req.body);
  if (
    !keys ||
    keys.length === 0 ||
    keys.some((key) => !PUBLIC_UPGRADE_FIELDS.has(key))
  ) {
    return false;
  }

  return UpdateQuoteBody.safeParse(req.body).success;
}

function isPublicAcceptanceRequest(req: Request): boolean {
  if (!PUBLIC_QUOTE_STATUS_PATH.test(req.path)) {
    return false;
  }

  const keys = objectKeys(req.body);
  if (!keys || keys.length !== 1 || keys[0] !== "status") {
    return false;
  }

  const parsed = SetQuoteStatusBody.safeParse(req.body);
  return parsed.success && parsed.data.status === "accepted";
}

/**
 * Customer quote pages are intentionally public. The web portal uses the
 * quote portal and estimate endpoints to display and accept a quote without
 * requiring the customer to create an account.
 */
function isPublicQuoteRequest(req: Request): boolean {
  const path = req.path;

  if (req.method === "GET") {
    return PUBLIC_QUOTE_PORTAL_PATH.test(path);
  }

  if (req.method === "POST") {
    return path === "/quotes/estimate";
  }

  if (req.method === "PATCH") {
    return isPublicUpgradeRequest(req) || isPublicAcceptanceRequest(req);
  }

  return false;
}

/**
 * Protects the API boundary while preserving the public customer quote flow.
 *
 * clerkMiddleware, mounted before this middleware, validates browser session
 * cookies and Authorization: Bearer <token> headers. It exposes the verified
 * identity as req.auth.userId.
 */
export function requireApiAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
    try {
      const auth = getAuth(req);
      if (auth.userId) {
        next();
        return;
      }
    } catch {
      // Public quote requests remain available even if no Clerk session exists.
    }
  }

  if (isPublicQuoteRequest(req)) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}