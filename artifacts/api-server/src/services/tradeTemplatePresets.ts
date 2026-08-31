import { and, asc, eq } from "drizzle-orm";
import { db, tradeTemplatePresetsTable } from "@workspace/db";

export type TradeTemplatePresetInput = {
  description: string;
  quantity: number;
  unitCost: number;
  markupPercentage: number;
  unit?: string;
  unitType?: string;
  wastagePercentage?: number;
  isBulkItem?: boolean;
  saveToMyPresets?: boolean;
};

type PresetDbClient = Pick<typeof db, "insert" | "select">;

function presetKey(description: string): string {
  const normalised = description
    .trim()
    .toLocaleLowerCase("en-AU")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return normalised || "custom-item";
}

function serialisePreset(row: typeof tradeTemplatePresetsTable.$inferSelect) {
  return {
    id: row.id,
    tradeType: row.tradeType,
    description: row.description,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitType: row.unitType,
    unitCost: Number(row.unitCost),
    markupPercentage: Number(row.markupPercentage),
    wastagePercentage: Number(row.wastagePercentage),
    isBulkItem: row.isBulkItem,
  };
}

export async function listTradeTemplatePresets(
  clerkUserId: string,
  tradeType: string,
  client: PresetDbClient = db,
) {
  const rows = await client
    .select()
    .from(tradeTemplatePresetsTable)
    .where(
      and(
        eq(tradeTemplatePresetsTable.clerkUserId, clerkUserId),
        eq(tradeTemplatePresetsTable.tradeType, tradeType),
      ),
    )
    .orderBy(asc(tradeTemplatePresetsTable.description));
  return rows.map(serialisePreset);
}

export async function saveTradeTemplatePreset(
  clerkUserId: string,
  tradeType: string,
  input: TradeTemplatePresetInput,
  client: PresetDbClient = db,
) {
  const description = input.description.trim();
  const values = {
    clerkUserId,
    tradeType,
    presetKey: presetKey(description),
    description,
    category: "custom",
    quantity: String(input.quantity),
    unit: input.unit?.trim() || "each",
    unitType: input.unitType?.trim() || "item",
    unitCost: String(input.unitCost),
    markupPercentage: String(input.markupPercentage),
    wastagePercentage: String(input.wastagePercentage ?? 0),
    isBulkItem: input.isBulkItem ?? false,
  };
  const [row] = await client
    .insert(tradeTemplatePresetsTable)
    .values(values)
    .onConflictDoUpdate({
      target: [
        tradeTemplatePresetsTable.clerkUserId,
        tradeTemplatePresetsTable.tradeType,
        tradeTemplatePresetsTable.presetKey,
      ],
      set: {
        description: values.description,
        category: values.category,
        quantity: values.quantity,
        unit: values.unit,
        unitType: values.unitType,
        unitCost: values.unitCost,
        markupPercentage: values.markupPercentage,
        wastagePercentage: values.wastagePercentage,
        isBulkItem: values.isBulkItem,
        updatedAt: new Date(),
      },
    })
    .returning();
  return serialisePreset(row);
}

export async function saveSelectedTradeTemplatePresets(
  clerkUserId: string,
  tradeType: string,
  inputs: TradeTemplatePresetInput[],
  client: PresetDbClient = db,
) {
  const selected = inputs.filter((input) => input.saveToMyPresets === true);
  for (const input of selected) {
    await saveTradeTemplatePreset(clerkUserId, tradeType, input, client);
  }
}