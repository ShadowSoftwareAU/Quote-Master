import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateOnboardingProfileBody,
  UpdateProfileSettingsBody,
} from "@workspace/api-zod";
import { getAuthenticatedClerkUserId } from "../middlewares/apiAuth";
import {
  onboardBusinessProfile,
  ProfileMetadataSyncError,
  ProfileMetadataSupersededError,
  updateBusinessProfileSettings,
} from "../services/businessProfiles";

const router: IRouter = Router();

function normaliseProfileBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const values = body as Record<string, unknown>;
  const trim = (value: unknown) =>
    typeof value === "string" ? value.trim() : value;
  const licence = trim(values.licenseNumber);
  return {
    ...values,
    businessName: trim(values.businessName),
    phoneNumber: trim(values.phoneNumber),
    tradeType: trim(values.tradeType),
    licenseNumber: licence === "" ? null : licence,
    role: trim(values.role),
  };
}

function publicProfile(profile: {
  id: number;
  businessName: string;
  phoneNumber: string;
  tradeType: string;
  licenseNumber: string | null;
  role: string;
  metadataSyncStatus: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: profile.id,
    businessName: profile.businessName,
    phoneNumber: profile.phoneNumber,
    tradeType: profile.tradeType,
    licenseNumber: profile.licenseNumber,
    role: profile.role,
    metadataSyncStatus: profile.metadataSyncStatus,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function requestFailure(req: Request, res: Response, error: unknown): void {
  req.log?.error({ err: error }, "Clerk profile metadata synchronisation failed");
  if (error instanceof ProfileMetadataSupersededError) {
    res.status(409).json({
      error: "A newer profile update was saved; retry to refresh the latest profile",
      retryable: true,
    });
    return;
  }
  if (error instanceof ProfileMetadataSyncError) {
    res.status(502).json({
      error: "Profile was saved, but account metadata could not be synchronised",
      retryable: true,
    });
    return;
  }
  res.status(500).json({ error: "Profile could not be saved" });
}

router.post("/onboarding", async (req: Request, res: Response) => {
  const parsed = CreateOnboardingProfileBody.safeParse(normaliseProfileBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const profile = await onboardBusinessProfile(
      getAuthenticatedClerkUserId(req),
      parsed.data,
    );
    res.status(201).json(publicProfile(profile));
  } catch (error) {
    requestFailure(req, res, error);
  }
});

router.put("/settings/profile", async (req: Request, res: Response) => {
  const parsed = UpdateProfileSettingsBody.safeParse(normaliseProfileBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const profile = await updateBusinessProfileSettings(
      getAuthenticatedClerkUserId(req),
      parsed.data,
    );
    if (!profile) {
      res.status(404).json({ error: "Complete onboarding before updating your profile" });
      return;
    }
    res.json(publicProfile(profile));
  } catch (error) {
    requestFailure(req, res, error);
  }
});

export default router;