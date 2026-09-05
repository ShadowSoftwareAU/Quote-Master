import { and, eq } from "drizzle-orm";
import {
  cadGeneratedLayoutsTable,
  db,
  quotesTable,
} from "@workspace/db";
import { CadLayoutPayloadSchema } from "@workspace/api-zod";
import { simulateCadFromText } from "./cadFromText";

interface CreateCadLayoutInput {
  quoteId: number;
  clerkUserId: string;
  prompt: string;
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

  return {
    id: created.id,
    quoteId: created.quoteId,
    prompt: created.prompt,
    tradeCategory: created.tradeCategory,
    layout: CadLayoutPayloadSchema.parse(created.layoutJson),
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}