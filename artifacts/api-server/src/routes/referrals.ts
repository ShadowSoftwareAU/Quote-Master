import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import QRCode from "qrcode";
import { db, referralSourcesTable, signUpLeadsTable } from "@workspace/db";
import {
  CreateReferralSourceBody,
  CreateSignUpLeadBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function sourceToJson(row: typeof referralSourcesTable.$inferSelect) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

function leadToJson(row: typeof signUpLeadsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    referralCode: row.referralCode,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/referrals/sources", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(referralSourcesTable)
    .orderBy(asc(referralSourcesTable.name));
  res.json(rows.map(sourceToJson));
});

router.post("/referrals/sources", async (req, res): Promise<void> => {
  const parsed = CreateReferralSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(referralSourcesTable)
    .values({
      code: d.code,
      name: d.name,
      ...(d.type ? { type: d.type } : {}),
      ...(d.description ? { description: d.description } : {}),
    })
    .returning();
  res.status(201).json(sourceToJson(row));
});

router.get("/referrals/sources/:id/qr", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [source] = await db
    .select()
    .from(referralSourcesTable)
    .where(eq(referralSourcesTable.id, id));
  if (!source) {
    res.status(404).json({ error: "Referral source not found" });
    return;
  }

  const domains = (process.env.REPLIT_DOMAINS ?? "localhost").split(",");
  const domain = domains[0]?.trim() ?? "localhost";
  const signUpUrl = `https://${domain}/sign-up?ref=${source.code}`;

  const svgString = await QRCode.toString(signUpUrl, { type: "svg" });

  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svgString);
});

router.get("/referrals/leads", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(signUpLeadsTable)
    .orderBy(desc(signUpLeadsTable.createdAt));
  res.json(rows.map(leadToJson));
});

router.post("/referrals/leads", async (req, res): Promise<void> => {
  const parsed = CreateSignUpLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;

  const [row] = await db
    .insert(signUpLeadsTable)
    .values({
      name: d.name,
      ...(d.email ? { email: d.email } : {}),
      ...(d.phone ? { phone: d.phone } : {}),
      ...(d.company ? { company: d.company } : {}),
      ...(d.referralCode ? { referralCode: d.referralCode } : {}),
      ...(d.utmSource ? { utmSource: d.utmSource } : {}),
      ...(d.utmMedium ? { utmMedium: d.utmMedium } : {}),
      ...(d.utmCampaign ? { utmCampaign: d.utmCampaign } : {}),
      ...(d.notes ? { notes: d.notes } : {}),
    })
    .returning();
  res.status(201).json(leadToJson(row));
});

export default router;
