import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import {
  SetMasterProjectPortalStatusBody,
  SetQuoteStatusBody,
  UpdateQuoteBody,
} from "@workspace/api-zod";

/**
 * The identity established at the API boundary. Route handlers should use
 * this value for ownership checks rather than accepting an identity from the
 * request body.
 */
export interface AuthenticatedRequest extends Request {
  clerkUserId: string;
}

declare global {
  namespace Express {
    interface Request {
      clerkUserId?: string;
    }
  }
}

const PORTAL_TOKEN_PATTERN = "[A-Za-z0-9_-]{43}";
const PUBLIC_QUOTE_PORTAL_PATH = new RegExp(`^/quote/${PORTAL_TOKEN_PATTERN}$`);
const PUBLIC_QUOTE_UPDATE_PATH = new RegExp(`^/quote/${PORTAL_TOKEN_PATTERN}$`);
const PUBLIC_QUOTE_STATUS_PATH = new RegExp(`^/quote/${PORTAL_TOKEN_PATTERN}/status$`);
const PUBLIC_MASTER_PROJECT_PORTAL_PATH = new RegExp(`^/master-project/${PORTAL_TOKEN_PATTERN}$`);
const PUBLIC_MASTER_PROJECT_STATUS_PATH = new RegExp(`^/master-project/${PORTAL_TOKEN_PATTERN}/status$`);
const PUBLIC_UPGRADE_FIELDS = new Set(["deckBoardType", "balustradeType"]);

function objectKeys(value: unknown): string[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return Object.keys(value);
}

function hasBodyClerkUserId(req: Request): boolean {
  const keys = objectKeys(req.body);
  return keys?.includes("clerkUserId") ?? false;
}

/**
 * Returns the identity installed by requireApiAuth.
 *
 * Keeping the runtime assertion here lets route handlers consume a shared,
 * non-optional authenticated request context without calling Clerk again.
 */
export function getAuthenticatedClerkUserId(req: Request): string {
  if (!req.clerkUserId) {
    throw new Error(
      "Authenticated request context is unavailable; requireApiAuth must run first",
    );
  }

  return req.clerkUserId;
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

function isPublicMasterProjectRequest(req: Request): boolean {
  if (req.method === "GET") {
    return PUBLIC_MASTER_PROJECT_PORTAL_PATH.test(req.path);
  }
  if (req.method !== "PATCH" || !PUBLIC_MASTER_PROJECT_STATUS_PATH.test(req.path)) {
    return false;
  }
  const keys = objectKeys(req.body);
  if (!keys || keys.length !== 1 || keys[0] !== "status") return false;
  const parsed = SetMasterProjectPortalStatusBody.safeParse(req.body);
  return parsed.success && parsed.data.status === "accepted";
}

/**
 * Customer quote pages are intentionally public. The web portal uses the
 * token-bound quote portal endpoints to display and accept a quote without
 * requiring the customer to create an account.
 */
function isPublicQuoteRequest(req: Request): boolean {
  const path = req.path;

  if (req.method === "GET") {
    return PUBLIC_QUOTE_PORTAL_PATH.test(path);
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
        if (hasBodyClerkUserId(req)) {
          res.status(400).json({
            error: "clerkUserId must not be supplied in the request body",
          });
          return;
        }

        req.clerkUserId = auth.userId;
        next();
        return;
      }
    } catch {
      // Public quote requests remain available even if no Clerk session exists.
    }
  }

  if (isPublicQuoteRequest(req) || isPublicMasterProjectRequest(req)) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}