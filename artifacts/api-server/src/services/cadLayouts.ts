import { and, desc, eq } from "drizzle-orm";
import { cadGeneratedLayoutsTable, db, quotesTable } from "@workspace/db";
import { CadLayoutPayloadSchema } from "@workspace/api-zod";
import { simulateCadFromText } from "./cadFromText";
import { evaluateCadLayoutCompliance } from "./cadCompliance";

interface CreateCadLayoutInput {
  quoteId: number;
  clerkUserId: string;
  prompt: string;
}

function formatCadLayout(layout: typeof cadGeneratedLayoutsTable.$inferSelect) {
  const validatedLayout = CadLayoutPayloadSchema.parse(layout.layoutJson);
  return {
    id: layout.id,
    quoteId: layout.quoteId,
    prompt: layout.prompt,
    tradeCategory: layout.tradeCategory,
    layout: validatedLayout,
    compliance: evaluateCadLayoutCompliance(validatedLayout),
    createdAt: layout.createdAt.toISOString(),
    updatedAt: layout.updatedAt.toISOString(),
  };
}

export async function getLatestCadLayoutForOwnedQuote({
  quoteId,
  clerkUserId,
}: Omit<CreateCadLayoutInput, "prompt">) {
  const [layout] = await db
    .select({
      id: cadGeneratedLayoutsTable.id,
      quoteId: cadGeneratedLayoutsTable.quoteId,
      prompt: cadGeneratedLayoutsTable.prompt,
      tradeCategory: cadGeneratedLayoutsTable.tradeCategory,
      layoutJson: cadGeneratedLayoutsTable.layoutJson,
      createdAt: cadGeneratedLayoutsTable.createdAt,
      updatedAt: cadGeneratedLayoutsTable.updatedAt,
    })
    .from(cadGeneratedLayoutsTable)
    .innerJoin(
      quotesTable,
      eq(cadGeneratedLayoutsTable.quoteId, quotesTable.id),
    )
    .where(
      and(
        eq(cadGeneratedLayoutsTable.quoteId, quoteId),
        eq(quotesTable.clerkUserId, clerkUserId),
      ),
    )
    .orderBy(
      desc(cadGeneratedLayoutsTable.createdAt),
      desc(cadGeneratedLayoutsTable.id),
    )
    .limit(1);

  return layout ? formatCadLayout(layout) : null;
}

export async function createCadLayoutForOwnedQuote({
  quoteId,
  clerkUserId,
  prompt,
}: CreateCadLayoutInput) {
  const [quote] = await db
    .select({
      id: quotesTable.id,
      lengthM: quotesTable.lengthM,
      widthM: quotesTable.widthM,
      heightM: quotesTable.heightM,
    })
    .from(quotesTable)
    .where(
      and(
        eq(quotesTable.id, quoteId),
        eq(quotesTable.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);

  if (!quote) {
    return null;
  }

  const layout = simulateCadFromText(prompt, {
    lengthM: Number(quote.lengthM),
    widthM: Number(quote.widthM),
    heightM: Number(quote.heightM),
  });

  const [created] = await db
    .insert(cadGeneratedLayoutsTable)
    .values({
      quoteId,
      prompt,
      tradeCategory: layout.tradeCategory,
      layoutJson: layout,
    })
    .returning();

  return formatCadLayout(created);
}
