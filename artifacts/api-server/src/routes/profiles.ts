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
import {
  normaliseTradeTypes,
  profileTradeTypes,
} from "../lib/tradeCatalogue";

const router: IRouter = Router();

function normaliseProfileBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const values = body as Record<string, unknown>;
  const trim = (value: unknown) =>
    typeof value === "string" ? value.trim() : value;
  const licence = trim(values.licenseNumber);
  const tradeTypes = Array.isArray(values.tradeTypes)
    ? values.tradeTypes.map(trim)
    : undefined;
  return {
    ...values,
    businessName: trim(values.businessName),
    phoneNumber: trim(values.phoneNumber),
    tradeType: trim(values.tradeType),
    tradeTypes,
    licenseNumber: licence === "" ? null : licence,
  };
}

function publicProfile(profile: {
  id: number;
  businessName: string;
  phoneNumber: string;
  tradeType: string;
  tradeTypes?: string[] | null;
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
    tradeTypes: profileTradeTypes(profile),
    licenseNumber: profile.licenseNumber,
    role: profile.role,
    isMasterBuilder: profile.isMasterBuilder,
    metadataSyncStatus: profile.metadataSyncStatus,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function requestFailure(req: Request, res: Response, error: unknown): void {
  req.log?.error(
    { err: error },
    "Clerk profile metadata synchronisation failed",
  );
  if (error instanceof ProfileMetadataSupersededError) {
    res.status(409).json({
      error:
        "A newer profile update was saved; retry to refresh the latest profile",
      retryable: true,
    });
    return;
  }
  if (error instanceof ProfileMetadataSyncError) {
    res.status(502).json({
      error:
        "Profile was saved, but account metadata could not be synchronised",
      retryable: true,
    });
    return;
  }
  res.status(500).json({ error: "Profile could not be saved" });
}

router.post("/onboarding", async (req: Request, res: Response) => {
  const parsed = CreateOnboardingProfileBody.safeParse(
    normaliseProfileBody(req.body),
  );
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
    const tradeTypes = normaliseTradeTypes(
      parsed.data.tradeTypes ?? [parsed.data.tradeType],
    );
    if (!tradeTypes || tradeTypes.length === 0 || tradeTypes.length > 3) {
      res.status(400).json({
        error: "Select between one and three supported trades",
      });
      return;
    }
    const profile = await onboardBusinessProfile(userId, {
      ...parsed.data,
      tradeType: tradeTypes[0],
      tradeTypes,
    });
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
  const parsed = UpdateProfileSettingsBody.safeParse(
    normaliseProfileBody(req.body),
  );
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const userId = getAuthenticatedClerkUserId(req);
    const existing = await getBusinessProfile(userId);
    if (!existing) {
      res
        .status(404)
        .json({ error: "Complete onboarding before updating your profile" });
      return;
    }
    const tradeTypes = normaliseTradeTypes(parsed.data.tradeTypes);
    if (!tradeTypes || tradeTypes.length === 0) {
      res.status(400).json({ error: "Select at least one supported trade" });
      return;
    }
    if (!existing.isMasterBuilder && tradeTypes.length > 3) {
      res.status(400).json({
        error: "Select up to three trades, or enable Master Builder access",
      });
      return;
    }
    const profile = await updateBusinessProfileSettings(userId, {
      ...parsed.data,
      tradeTypes,
    });
    if (!profile) {
      res
        .status(404)
        .json({ error: "Complete onboarding before updating your profile" });
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
    const existing = await getBusinessProfile(userId);
    if (
      existing &&
      !parsed.data.isMasterBuilder &&
      profileTradeTypes(existing).length > 3
    ) {
      res.status(409).json({
        error:
          "Reduce the profile to three trades before removing Master Builder access",
      });
      return;
    }
    const updated = await setMasterBuilderFlag(
      userId,
      parsed.data.isMasterBuilder,
    );
    if (!updated) {
      res
        .status(404)
        .json({ error: "Complete onboarding before updating your profile" });
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
