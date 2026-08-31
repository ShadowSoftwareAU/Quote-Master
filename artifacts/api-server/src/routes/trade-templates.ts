import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, tradeTemplatesTable } from "@workspace/db";

const router: IRouter = Router();

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

export default router;