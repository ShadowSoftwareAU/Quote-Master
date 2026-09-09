import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { asc } from "drizzle-orm";
import { db, businessProfilesTable, tradeTemplatesTable } from "@workspace/db";
import {
  ListTradeTemplatePresetsResponse,
  ListTradeTemplatesResponse,
  SaveTradeTemplatePresetBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { requireBusinessRole } from "../middlewares/businessRoleAuth";
import {
  listTradeTemplatePresets,
  saveTradeTemplatePreset,
} from "../services/tradeTemplatePresets";
import {
  canonicalTradeType,
  profileTradeTypes,
  TRADE_CATALOGUE,
} from "../lib/tradeCatalogue";

const router: IRouter = Router();
const requireQuoteManager = requireBusinessRole("Owner", "Employee");

router.get("/trade-catalogue", (_req, res): void => {
  res.json(TRADE_CATALOGUE);
});

async function getTradeTypes(clerkUserId: string): Promise<string[]> {
  const [profile] = await db
    .select({
      tradeType: businessProfilesTable.tradeType,
      tradeTypes: businessProfilesTable.tradeTypes,
    })
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.clerkUserId, clerkUserId))
    .limit(1);
  return profile ? profileTradeTypes(profile) : [];
}

router.get("/trade-templates", async (_req, res): Promise<void> => {
  const templates = await db
    .select()
    .from(tradeTemplatesTable)
    .orderBy(
      asc(tradeTemplatesTable.tradeType),
      asc(tradeTemplatesTable.name),
    );

  const latest = Array.from(
    templates.reduce((map, template) => {
      const key = `${template.tradeType}\u0000${template.slug}`;
      const current = map.get(key);
      if (!current || (template.templateRevision ?? 0) > (current.templateRevision ?? 0)) {
        map.set(key, template);
      }
      return map;
    }, new Map<string, (typeof templates)[number]>()),
  ).map(([, template]) => template);
  res.json(
    ListTradeTemplatesResponse.parse(
      latest.map((template) => ({
      id: template.id,
      tradeType: template.tradeType,
      name: template.name,
      slug: template.slug,
      defaultLineItems: template.defaultLineItems,
        engineVersion: template.engineVersion,
        templateRevision: template.templateRevision,
        parameterDefinitions: template.parameterDefinitions,
        bomRules: template.bomRules,
      })),
    ),
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
    const tradeTypes = await getTradeTypes(clerkUserId);
    if (tradeTypes.length === 0) {
      res.status(409).json({ error: "Complete onboarding before loading presets" });
      return;
    }
    const requestedTrade =
      typeof req.query.tradeType === "string"
        ? canonicalTradeType(req.query.tradeType)
        : tradeTypes[0];
    if (!requestedTrade || !tradeTypes.includes(requestedTrade)) {
      res.status(403).json({ error: "Trade is not selected on this profile" });
      return;
    }
    const presets = await listTradeTemplatePresets(clerkUserId, requestedTrade);
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
    const tradeTypes = await getTradeTypes(clerkUserId);
    if (tradeTypes.length === 0) {
      res.status(409).json({ error: "Complete onboarding before saving presets" });
      return;
    }
    const preset = await saveTradeTemplatePreset(
      clerkUserId,
      tradeTypes[0],
      parsed.data,
    );
    res.status(201).json(preset);
  },
);

export default router;