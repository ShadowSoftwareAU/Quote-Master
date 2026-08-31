import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateOnboardingProfileBody,
  SetMasterBuilderFlagBody,
  UpdateProfileSettingsBody,
} from "@workspace/api-zod";
import { getAuthenticatedClerkUserId } from "../middlewares/apiAuth";
import { requireOwner } from "../middlewares/businessRoleAuth";
import {
  getBusinessProfile,
  onboardBusinessProfile,
  ProfileMetadataSyncError,
  ProfileMetadataSupersededError,
  setMasterBuilderFlag,
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
  isMasterBuilder: boolean;
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
    isMasterBuilder: profile.isMasterBuilder,
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
    const userId = getAuthenticatedClerkUserId(req);
    if (await getBusinessProfile(userId)) {
      res.status(409).json({ error: "Onboarding is already complete" });
      return;
    }
    const profile = await onboardBusinessProfile(
      userId,
      parsed.data,
    );
    res.status(201).json(publicProfile(profile));
  } catch (error) {
    requestFailure(req, res, error);
  }
});

router.get("/settings/profile", async (req: Request, res: Response) => {
  const profile = await getBusinessProfile(getAuthenticatedClerkUserId(req));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(publicProfile(profile));
});

router.put("/settings/profile", async (req: Request, res: Response) => {
  const parsed = UpdateProfileSettingsBody.safeParse(normaliseProfileBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const userId = getAuthenticatedClerkUserId(req);
    const existing = await getBusinessProfile(userId);
    if (!existing) {
      res.status(404).json({ error: "Complete onboarding before updating your profile" });
      return;
    }
    if (parsed.data.role !== existing.role) {
      res.status(403).json({ error: "Business roles can only be changed by an Owner or administrator" });
      return;
    }
    const profile = await updateBusinessProfileSettings(
      userId,
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

router.patch(
  "/settings/profile/master-builder",
  requireOwner,
  async (req: Request, res: Response) => {
    const parsed = SetMasterBuilderFlagBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const userId = getAuthenticatedClerkUserId(req);
    const updated = await setMasterBuilderFlag(
      userId,
      parsed.data.isMasterBuilder,
    );
    if (!updated) {
      res.status(404).json({ error: "Complete onboarding before updating your profile" });
      return;
    }
    req.log?.info(
      { userId, isMasterBuilder: parsed.data.isMasterBuilder },
      "Master Builder profile flag changed",
    );
    res.json(publicProfile(updated));
  },
);

export default router;