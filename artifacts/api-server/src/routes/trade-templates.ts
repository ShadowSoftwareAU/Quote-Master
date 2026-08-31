import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { asc } from "drizzle-orm";
import { db, businessProfilesTable, tradeTemplatesTable } from "@workspace/db";
import {
  ListTradeTemplatePresetsResponse,
  SaveTradeTemplatePresetBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { requireBusinessRole } from "../middlewares/businessRoleAuth";
import {
  listTradeTemplatePresets,
  saveTradeTemplatePreset,
} from "../services/tradeTemplatePresets";

const router: IRouter = Router();
const requireQuoteManager = requireBusinessRole("Owner", "Employee");

async function getTradeType(clerkUserId: string): Promise<string | null> {
  const [profile] = await db
    .select({ tradeType: businessProfilesTable.tradeType })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile?.tradeType ?? null;
}

router.get("/trade-templates", async (_req, res): Promise<void> => {
  const templates = await db
    .select()
    .from(tradeTemplatesTable)
    .orderBy(
      asc(tradeTemplatesTable.tradeType),
      asc(tradeTemplatesTable.name),
    );

  res.json(
    templates.map((template) => ({
      id: template.id,
      tradeType: template.tradeType,
      name: template.name,
      slug: template.slug,
      defaultLineItems: template.defaultLineItems,
    })),
  );
});

router.get(
  "/trade-template-presets",
  requireQuoteManager,
  async (req, res): Promise<void> => {
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const tradeType = await getTradeType(clerkUserId);
    if (!tradeType) {
      res.status(409).json({ error: "Complete onboarding before loading presets" });
      return;
    }
    const presets = await listTradeTemplatePresets(clerkUserId, tradeType);
    res.json(ListTradeTemplatePresetsResponse.parse(presets));
  },
);

router.post(
  "/trade-template-presets",
  requireQuoteManager,
  async (req, res): Promise<void> => {
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = SaveTradeTemplatePresetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const tradeType = await getTradeType(clerkUserId);
    if (!tradeType) {
      res.status(409).json({ error: "Complete onboarding before saving presets" });
      return;
    }
    const preset = await saveTradeTemplatePreset(
      clerkUserId,
      tradeType,
      parsed.data,
    );
    res.status(201).json(preset);
  },
);

export default router;